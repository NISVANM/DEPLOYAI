'use server'

import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/lib/db/drizzle-client'
import {
    emailEvents,
    emailTemplates,
    integrationConfigs,
    schedulingProviderConfigs,
    webhookEvents,
} from '@/lib/db/schema'
import { retryPendingEmailEvents, retryPendingWebhookEvents } from '@/lib/integrations/dispatcher'
import { isSchedulingEnabled } from '@/lib/feature-flags'
import crypto from 'crypto'
import { toSheetPayload } from '@/lib/integrations/dispatcher'
import { requireCurrentUserId, requireOwnedCompanyId } from '@/lib/actions/auth-context'

type WebhookConfigInput = {
    enabled: boolean
    url: string
    secret: string
    googleSheetWebhookUrl?: string
}

export type SchedulingConfigInput = {
    enabled: boolean
    provider: string
    /** Empty = keep existing key */
    calcomApiKey?: string
    calcomBookingBaseUrl?: string
    calcomApiBaseUrl?: string
    calcomUsername?: string
    calcomEventSlug?: string
    calcomOrganizationSlug?: string
    calcomTeamSlug?: string
}

async function getCurrentUserCompany() {
    const userId = await requireCurrentUserId()
    const companyId = await requireOwnedCompanyId(userId)
    return { userId, companyId }
}

export async function getIntegrationSettings() {
    const { companyId } = await getCurrentUserCompany()

    const [configRows, scheduling, templates, recentWebhookEvents, recentEmailEvents] = await Promise.all([
        getDb()
            .select()
            .from(integrationConfigs)
            .where(eq(integrationConfigs.companyId, companyId)),
        getDb()
            .select()
            .from(schedulingProviderConfigs)
            .where(eq(schedulingProviderConfigs.companyId, companyId))
            .limit(1),
        getDb()
            .select()
            .from(emailTemplates)
            .where(eq(emailTemplates.companyId, companyId))
            .orderBy(emailTemplates.key),
        getDb()
            .select()
            .from(webhookEvents)
            .where(eq(webhookEvents.companyId, companyId))
            .orderBy(desc(webhookEvents.createdAt))
            .limit(10),
        getDb()
            .select()
            .from(emailEvents)
            .where(eq(emailEvents.companyId, companyId))
            .orderBy(desc(emailEvents.createdAt))
            .limit(10),
    ])

    const map = Object.fromEntries(configRows.map((row) => [row.provider, row]))
    const webhook = map.generic_webhook

    return {
        webhook: {
            enabled: webhook?.enabled ?? false,
            url: String((webhook?.config as Record<string, unknown> | undefined)?.url ?? ''),
            secret: String((webhook?.config as Record<string, unknown> | undefined)?.secret ?? ''),
            googleSheetWebhookUrl: String((webhook?.config as Record<string, unknown> | undefined)?.googleSheetWebhookUrl ?? ''),
        },
        scheduling: (() => {
            const sched = scheduling[0]
            const calRaw = (sched?.config as Record<string, unknown> | undefined)?.calcom as
                | Record<string, unknown>
                | undefined
            const apiKey = typeof calRaw?.apiKey === 'string' ? calRaw.apiKey : ''
            return {
                enabled: sched?.enabled ?? false,
                provider: sched?.provider ?? 'none',
                calcom: {
                    hasApiKey: apiKey.length > 0,
                    apiKeyLast4: apiKey.length >= 4 ? apiKey.slice(-4) : '',
                    bookingBaseUrl: String(calRaw?.bookingBaseUrl ?? 'https://cal.com'),
                    apiBaseUrl: String(calRaw?.apiBaseUrl ?? 'https://api.cal.com'),
                    username: String(calRaw?.username ?? ''),
                    eventSlug: String(calRaw?.eventSlug ?? ''),
                    organizationSlug: String(calRaw?.organizationSlug ?? ''),
                    teamSlug: String(calRaw?.teamSlug ?? ''),
                },
            }
        })(),
        templates,
        recentWebhookEvents,
        recentEmailEvents,
        featureSchedulingUi: isSchedulingEnabled(),
    }
}

async function upsertIntegrationConfig(
    companyId: string,
    provider: 'generic_webhook' | 'smtp',
    enabled: boolean,
    config: Record<string, unknown>
) {
    const rows = await getDb()
        .select({ id: integrationConfigs.id })
        .from(integrationConfigs)
        .where(and(eq(integrationConfigs.companyId, companyId), eq(integrationConfigs.provider, provider)))
        .limit(1)

    if (rows.length) {
        await getDb()
            .update(integrationConfigs)
            .set({ enabled, config, updatedAt: new Date() })
            .where(eq(integrationConfigs.id, rows[0].id))
        return
    }

    await getDb().insert(integrationConfigs).values({
        companyId,
        provider,
        enabled,
        config,
    })
}

export async function updateWebhookConfig(input: WebhookConfigInput) {
    const { companyId } = await getCurrentUserCompany()
    await upsertIntegrationConfig(companyId, 'generic_webhook', input.enabled, {
        enabled: input.enabled,
        url: input.url.trim(),
        secret: input.secret.trim(),
        googleSheetWebhookUrl: (input.googleSheetWebhookUrl ?? '').trim(),
    })
    revalidatePath('/dashboard/settings')
}

export async function updateSchedulingConfig(input: SchedulingConfigInput) {
    const { companyId } = await getCurrentUserCompany()
    const rows = await getDb()
        .select({ id: schedulingProviderConfigs.id, config: schedulingProviderConfigs.config })
        .from(schedulingProviderConfigs)
        .where(eq(schedulingProviderConfigs.companyId, companyId))
        .limit(1)

    const prevRoot = (rows[0]?.config as Record<string, unknown> | undefined) ?? {}
    const prevCal = (prevRoot.calcom as Record<string, unknown> | undefined) ?? {}

    const nextCal: Record<string, unknown> = { ...prevCal }
    if (input.calcomBookingBaseUrl !== undefined) {
        nextCal.bookingBaseUrl = input.calcomBookingBaseUrl.trim() || 'https://cal.com'
    }
    if (input.calcomApiBaseUrl !== undefined) {
        nextCal.apiBaseUrl = input.calcomApiBaseUrl.trim() || 'https://api.cal.com'
    }
    if (input.calcomUsername !== undefined) nextCal.username = input.calcomUsername.trim()
    if (input.calcomEventSlug !== undefined) nextCal.eventSlug = input.calcomEventSlug.trim()
    if (input.calcomOrganizationSlug !== undefined) {
        nextCal.organizationSlug = input.calcomOrganizationSlug.trim() || undefined
    }
    if (input.calcomTeamSlug !== undefined) nextCal.teamSlug = input.calcomTeamSlug.trim() || undefined
    if (input.calcomApiKey?.trim()) {
        nextCal.apiKey = input.calcomApiKey.trim()
    } else if (prevCal.apiKey) {
        nextCal.apiKey = prevCal.apiKey
    }

    if (input.provider === 'calcom') {
        if (nextCal.bookingBaseUrl == null || String(nextCal.bookingBaseUrl).trim() === '') {
            nextCal.bookingBaseUrl = 'https://cal.com'
        }
        if (nextCal.apiBaseUrl == null || String(nextCal.apiBaseUrl).trim() === '') {
            nextCal.apiBaseUrl = 'https://api.cal.com'
        }
    }

    const nextConfig = { ...prevRoot, calcom: nextCal }

    if (rows.length) {
        await getDb()
            .update(schedulingProviderConfigs)
            .set({
                enabled: input.enabled,
                provider: input.provider,
                config: nextConfig,
                updatedAt: new Date(),
            })
            .where(eq(schedulingProviderConfigs.id, rows[0].id))
    } else {
        await getDb().insert(schedulingProviderConfigs).values({
            companyId,
            enabled: input.enabled,
            provider: input.provider,
            config: nextConfig,
        })
    }
    revalidatePath('/dashboard/settings')
}

export async function upsertEmailTemplate(input: { key: string; subject: string; bodyHtml: string; enabled: boolean }) {
    const { companyId } = await getCurrentUserCompany()
    const rows = await getDb()
        .select({ id: emailTemplates.id })
        .from(emailTemplates)
        .where(and(eq(emailTemplates.companyId, companyId), eq(emailTemplates.key, input.key)))
        .limit(1)

    if (rows.length) {
        await getDb()
            .update(emailTemplates)
            .set({
                subject: input.subject,
                bodyHtml: input.bodyHtml,
                enabled: input.enabled,
                updatedAt: new Date(),
            })
            .where(eq(emailTemplates.id, rows[0].id))
    } else {
        await getDb().insert(emailTemplates).values({
            companyId,
            key: input.key,
            subject: input.subject,
            bodyHtml: input.bodyHtml,
            enabled: input.enabled,
        })
    }

    revalidatePath('/dashboard/settings')
}

export async function retryPendingIntegrations() {
    const { companyId } = await getCurrentUserCompany()
    const webhookRetried = await retryPendingWebhookEvents(companyId, 20)
    const emailRetried = await retryPendingEmailEvents(companyId, 20)
    revalidatePath('/dashboard/settings')
    return { webhookRetried, emailRetried }
}

export async function sendTestWebhook() {
    const { companyId } = await getCurrentUserCompany()
    const rows = await getDb()
        .select({ enabled: integrationConfigs.enabled, config: integrationConfigs.config })
        .from(integrationConfigs)
        .where(and(eq(integrationConfigs.companyId, companyId), eq(integrationConfigs.provider, 'generic_webhook')))
        .limit(1)
    if (!rows.length || !rows[0].enabled) throw new Error('Enable webhook integration first')

    const config = rows[0].config as Record<string, unknown>
    const url = String(config.url ?? '').trim()
    const googleSheetWebhookUrl = String(config.googleSheetWebhookUrl ?? '').trim()
    const secret = String(config.secret ?? '')
    if (!url && !googleSheetWebhookUrl) throw new Error('Webhook URL or Google Sheet URL is required')

    const primaryPayload = {
        eventType: 'candidate.hired.test',
        eventVersion: 1,
        sentAt: new Date().toISOString(),
        data: {
            candidateName: 'Test Candidate',
            candidateEmail: 'candidate@example.com',
            jobTitle: 'Test Role',
            status: 'hired',
        },
    }

    const sheetSource: Record<string, unknown> = {
        eventType: 'candidate.hired.test',
        eventVersion: 1,
        companyId,
        candidateId: '00000000-0000-0000-0000-000000000000',
        candidateName: 'Test Candidate',
        candidateEmail: 'candidate@example.com',
        candidatePhone: '',
        candidateScore: null,
        jobId: '',
        jobTitle: 'Test Role',
        fromStatus: 'offered',
        toStatus: 'hired',
        changedByUserId: '',
        changedAt: new Date().toISOString(),
    }
    const sheetBody = JSON.stringify(toSheetPayload(sheetSource))

    const uniqueTargets = [...new Set([url, googleSheetWebhookUrl].filter(Boolean))]
    const errors: string[] = []
    for (const targetUrl of uniqueTargets) {
        const useSheetShape = Boolean(googleSheetWebhookUrl) && targetUrl === googleSheetWebhookUrl
        const body = useSheetShape ? sheetBody : JSON.stringify(primaryPayload)
        const signature = secret ? crypto.createHmac('sha256', secret).update(body).digest('hex') : ''
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-RecruitAI-Event': 'candidate.hired.test',
                'X-RecruitAI-Signature': signature,
            },
            body,
        })
        if (!response.ok) {
            errors.push(`${targetUrl} → ${response.status}`)
        }
    }
    if (errors.length) {
        throw new Error(`Test webhook failed: ${errors.join('; ')}`)
    }

    return { ok: true }
}

