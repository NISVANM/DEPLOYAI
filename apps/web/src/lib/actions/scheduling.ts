'use server'

import crypto from 'crypto'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { getDb } from '@/lib/db/drizzle-client'
import { isSchedulingEnabled } from '@/lib/feature-flags'
import {
    buildCalcomBookingPageUrl,
    calcomConfigReadyForLinks,
    calcomFetchEventTypes,
    type CalcomStoredConfig,
} from '@/lib/integrations/calcom'
import { candidates, companies, jobs, schedulingProviderConfigs, schedulingTokens } from '@/lib/db/schema'
import { getPublicAppBaseUrl } from '@/lib/public-app-url'

const TOKEN_BYTES = 24
const TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000

function getCalcomFromConfig(config: unknown): CalcomStoredConfig | null {
    if (!config || typeof config !== 'object') return null
    const c = (config as { calcom?: CalcomStoredConfig }).calcom
    if (!c || typeof c !== 'object') return null
    return c
}

async function getCurrentUserCompany() {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')
    const rows = await getDb().select({ id: companies.id }).from(companies).where(eq(companies.ownerId, user.id)).limit(1)
    if (!rows.length) throw new Error('Company not found')
    return { companyId: rows[0].id }
}

/** Active Cal.com config for a company (Settings enabled + provider calcom + username/slug). */
export async function getResolvedCalcomConfig(companyId: string): Promise<CalcomStoredConfig | null> {
    const rows = await getDb()
        .select({
            enabled: schedulingProviderConfigs.enabled,
            provider: schedulingProviderConfigs.provider,
            config: schedulingProviderConfigs.config,
        })
        .from(schedulingProviderConfigs)
        .where(eq(schedulingProviderConfigs.companyId, companyId))
        .limit(1)
    if (!rows.length || !rows[0].enabled || rows[0].provider !== 'calcom') return null
    const cal = getCalcomFromConfig(rows[0].config)
    return cal
}

export async function isCalcomSchedulingActiveForCompany(companyId: string): Promise<boolean> {
    if (!isSchedulingEnabled()) return false
    const cal = await getResolvedCalcomConfig(companyId)
    return calcomConfigReadyForLinks(cal)
}

/**
 * Returns an active invite URL for this candidate+job (reuses valid token if one exists).
 * Used when status moves to interviewed (email) and for manual "Copy scheduling link".
 */
export async function ensureSchedulingInviteLinkForInterview(params: {
    companyId: string
    candidateId: string
    jobId: string
}): Promise<string | null> {
    const { companyId, candidateId, jobId } = params
    if (!(await isCalcomSchedulingActiveForCompany(companyId))) return null

    const existing = await getDb()
        .select({ token: schedulingTokens.token, expiresAt: schedulingTokens.expiresAt })
        .from(schedulingTokens)
        .where(
            and(
                eq(schedulingTokens.companyId, companyId),
                eq(schedulingTokens.candidateId, candidateId),
                eq(schedulingTokens.jobId, jobId),
                isNull(schedulingTokens.usedAt),
                gt(schedulingTokens.expiresAt, new Date())
            )
        )
        .orderBy(desc(schedulingTokens.createdAt))
        .limit(1)

    if (existing.length) {
        return `${getPublicAppBaseUrl()}/schedule/${existing[0].token}`
    }

    const token = crypto.randomBytes(TOKEN_BYTES).toString('hex')
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
    await getDb().insert(schedulingTokens).values({
        companyId,
        candidateId,
        jobId,
        token,
        expiresAt,
    })
    revalidatePath('/dashboard/scheduling')
    return `${getPublicAppBaseUrl()}/schedule/${token}`
}

export async function listSchedulingInvitesForCompany(): Promise<
    Array<{
        id: string
        inviteUrl: string
        expiresAt: Date
        usedAt: Date | null
        createdAt: Date
        candidateName: string
        jobTitle: string
    }>
> {
    const { companyId } = await getCurrentUserCompany()
    const rows = await getDb()
        .select({
            id: schedulingTokens.id,
            token: schedulingTokens.token,
            expiresAt: schedulingTokens.expiresAt,
            usedAt: schedulingTokens.usedAt,
            createdAt: schedulingTokens.createdAt,
            candidateName: candidates.name,
            jobTitle: jobs.title,
        })
        .from(schedulingTokens)
        .innerJoin(candidates, eq(schedulingTokens.candidateId, candidates.id))
        .innerJoin(jobs, eq(schedulingTokens.jobId, jobs.id))
        .where(eq(schedulingTokens.companyId, companyId))
        .orderBy(desc(schedulingTokens.createdAt))
        .limit(50)

    const base = getPublicAppBaseUrl()
    return rows.map((r) => ({
        id: r.id,
        inviteUrl: `${base}/schedule/${r.token}`,
        expiresAt: r.expiresAt,
        usedAt: r.usedAt,
        createdAt: r.createdAt,
        candidateName: r.candidateName,
        jobTitle: r.jobTitle,
    }))
}

export async function testCalcomApiConnection(): Promise<{ ok: true; eventTypeCount: number }> {
    const { companyId } = await getCurrentUserCompany()
    const cal = await getResolvedCalcomConfig(companyId)
    if (!cal?.apiKey?.trim()) throw new Error('Save a Cal.com API key first, then test again')
    const username = cal.username?.trim()
    const res = await calcomFetchEventTypes(cal.apiKey.trim(), cal.apiBaseUrl, {
        username: username || undefined,
    })
    const count = Array.isArray(res.data) ? res.data.length : 0
    return { ok: true, eventTypeCount: count }
}

export async function createCandidateSchedulingLink(
    candidateId: string,
    jobId: string
): Promise<{ url: string; expiresAt: string }> {
    const { companyId } = await getCurrentUserCompany()
    const cand = await getDb()
        .select({ id: candidates.id })
        .from(candidates)
        .where(and(eq(candidates.id, candidateId), eq(candidates.jobId, jobId), eq(candidates.companyId, companyId)))
        .limit(1)
    if (!cand.length) throw new Error('Candidate not found')

    const job = await getDb()
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId)))
        .limit(1)
    if (!job.length) throw new Error('Job not found')

    const url = await ensureSchedulingInviteLinkForInterview({ companyId, candidateId, jobId })
    if (!url) throw new Error('Enable Cal.com in Settings and set username + event slug')

    const latest = await getDb()
        .select({ expiresAt: schedulingTokens.expiresAt })
        .from(schedulingTokens)
        .where(
            and(
                eq(schedulingTokens.companyId, companyId),
                eq(schedulingTokens.candidateId, candidateId),
                eq(schedulingTokens.jobId, jobId)
            )
        )
        .orderBy(desc(schedulingTokens.createdAt))
        .limit(1)

    revalidatePath(`/dashboard/jobs/${jobId}/candidates/${candidateId}`)
    return { url, expiresAt: latest[0]!.expiresAt.toISOString() }
}

export type PublicScheduleViewModel = {
    calcomUrl: string
    jobTitle: string
    candidateFirstName: string
    expiresAt: string
}

/** Public (unauthenticated) — resolves token and builds Cal.com URL with prefilled candidate. */
export async function getPublicScheduleByToken(token: string): Promise<PublicScheduleViewModel | null> {
    const trimmed = token?.trim()
    if (!trimmed) return null
    const rows = await getDb()
        .select({
            companyId: schedulingTokens.companyId,
            candidateId: schedulingTokens.candidateId,
            jobId: schedulingTokens.jobId,
            expiresAt: schedulingTokens.expiresAt,
            usedAt: schedulingTokens.usedAt,
        })
        .from(schedulingTokens)
        .where(eq(schedulingTokens.token, trimmed))
        .limit(1)
    if (!rows.length) return null
    const row = rows[0]
    if (row.usedAt) return null
    if (row.expiresAt.getTime() <= Date.now()) return null

    const cal = await getResolvedCalcomConfig(row.companyId)
    if (!cal || !calcomConfigReadyForLinks(cal)) return null

    const [candRows, jobRows] = await Promise.all([
        getDb()
            .select({ name: candidates.name, email: candidates.email })
            .from(candidates)
            .where(eq(candidates.id, row.candidateId))
            .limit(1),
        getDb()
            .select({ title: jobs.title })
            .from(jobs)
            .where(eq(jobs.id, row.jobId))
            .limit(1),
    ])
    const candidateName = candRows[0]?.name ?? 'Candidate'
    const jobTitle = jobRows[0]?.title ?? 'Interview'
    const email = candRows[0]?.email

    const calcomUrl = buildCalcomBookingPageUrl({
        bookingBaseUrl: cal.bookingBaseUrl,
        username: cal.username,
        eventSlug: cal.eventSlug,
        attendeeEmail: email ?? undefined,
        attendeeName: candidateName,
    })

    return {
        calcomUrl,
        jobTitle,
        candidateFirstName: candidateName.split(/\s+/)[0] ?? candidateName,
        expiresAt: row.expiresAt.toISOString(),
    }
}
