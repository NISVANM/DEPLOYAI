import crypto from 'crypto'
import { and, eq, isNull, lte, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle-client'
import {
    candidates,
    companies,
    emailEvents,
    emailTemplates,
    integrationConfigs,
    jobs,
    webhookEvents,
} from '@/lib/db/schema'
import type { CandidateStatusChangedEvent } from '@/lib/integrations/types'
import { sendSmtpMail, type SmtpConfig } from '@/lib/integrations/smtp'
import { ensureSchedulingInviteLinkForInterview } from '@/lib/actions/scheduling'

const MAX_RETRY_ATTEMPTS = 5

type GenericWebhookConfig = {
    url?: string
    secret?: string
    googleSheetWebhookUrl?: string
    enabled?: boolean
}

type SmtpResolvedConfig = {
    enabled: boolean
    source: 'env'
    config: SmtpConfig | null
}

function getRetryDelayMs(attempts: number): number {
    const base = 60_000
    return base * Math.pow(2, Math.max(0, attempts - 1))
}

function renderTemplate(template: string, values: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, token) => values[token] ?? '')
}

function cleanError(error: unknown): string {
    if (error instanceof Error) return error.message.slice(0, 500)
    return String(error).slice(0, 500)
}

async function getIntegrationConfig<TConfig>(companyId: string, provider: 'generic_webhook') {
    const rows = await getDb()
        .select({ id: integrationConfigs.id, enabled: integrationConfigs.enabled, config: integrationConfigs.config })
        .from(integrationConfigs)
        .where(and(eq(integrationConfigs.companyId, companyId), eq(integrationConfigs.provider, provider)))
        .limit(1)
    if (!rows.length) return null
    return {
        id: rows[0].id,
        enabled: rows[0].enabled,
        config: (rows[0].config ?? {}) as TConfig,
    }
}

/** True when Settings has generic webhook on and at least one URL — same bar as delivery (not env FEATURE_HRIS_WEBHOOKS). */
async function companyHasActiveGenericWebhook(companyId: string): Promise<boolean> {
    const integration = await getIntegrationConfig<GenericWebhookConfig>(companyId, 'generic_webhook')
    const config = integration?.config ?? {}
    const hasTargets = [config.url, config.googleSheetWebhookUrl].some((v) => String(v ?? '').trim())
    return Boolean(integration?.enabled && config?.enabled !== false && hasTargets)
}

async function queueWebhookEvent(event: CandidateStatusChangedEvent) {
    const payload = {
        eventType: 'candidate.status.changed',
        eventVersion: 1,
        companyId: event.companyId,
        candidateId: event.candidateId,
        candidateName: event.candidateName,
        candidateEmail: event.candidateEmail,
        candidatePhone: event.candidatePhone ?? '',
        candidateScore: event.candidateScore ?? null,
        jobId: event.jobId,
        jobTitle: event.jobTitle,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        changedByUserId: event.changedByUserId,
        changedAt: event.changedAt.toISOString(),
    }

    const [created] = await getDb()
        .insert(webhookEvents)
        .values({
            companyId: event.companyId,
            candidateId: event.candidateId,
            jobId: event.jobId,
            eventType: 'candidate.hired',
            payload,
            status: 'pending',
        })
        .returning({ id: webhookEvents.id })
    return created.id
}

/** Flat JSON for Google Apps Script row mapping — same shape production uses for the Sheet URL. */
export function toSheetPayload(payload: Record<string, unknown>) {
    return {
        eventType: String(payload.eventType ?? ''),
        eventVersion: Number(payload.eventVersion ?? 1),
        changedAt: String(payload.changedAt ?? ''),
        companyId: String(payload.companyId ?? ''),
        candidateId: String(payload.candidateId ?? ''),
        candidateName: String(payload.candidateName ?? ''),
        candidateEmail: String(payload.candidateEmail ?? ''),
        candidatePhone: String(payload.candidatePhone ?? ''),
        candidateScore: payload.candidateScore ?? '',
        jobId: String(payload.jobId ?? ''),
        jobTitle: String(payload.jobTitle ?? ''),
        fromStatus: String(payload.fromStatus ?? ''),
        toStatus: String(payload.toStatus ?? ''),
        changedByUserId: String(payload.changedByUserId ?? ''),
    }
}

async function attemptWebhookDelivery(eventId: string): Promise<void> {
    const rows = await getDb()
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.id, eventId))
        .limit(1)
    if (!rows.length) return
    const row = rows[0]

    const integration = await getIntegrationConfig<GenericWebhookConfig>(row.companyId, 'generic_webhook')
    const config = integration?.config ?? {}
    const isEnabled = integration?.enabled && config?.enabled !== false
    if (!isEnabled) return

    const targetUrls = [...new Set([config.url, config.googleSheetWebhookUrl].map((v) => (v ?? '').trim()).filter(Boolean))]

    if (!targetUrls.length) return

    try {
        const payloadString = JSON.stringify(row.payload)
        const signature = config.secret
            ? crypto.createHmac('sha256', config.secret).update(payloadString).digest('hex')
            : ''
        const errors: string[] = []
        for (const targetUrl of targetUrls) {
            const isGoogleSheetTarget = targetUrl === (config.googleSheetWebhookUrl ?? '').trim()
            const bodyObject = isGoogleSheetTarget ? toSheetPayload(row.payload as Record<string, unknown>) : row.payload
            const body = JSON.stringify(bodyObject)
            const res = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-RecruitAI-Event': String(row.eventType),
                    'X-RecruitAI-Signature': signature,
                },
                body,
            })

            if (!res.ok) {
                errors.push(`${targetUrl} -> ${res.status}`)
            }
        }
        if (errors.length) {
            throw new Error(`Webhook request failed: ${errors.join(', ')}`)
        }

        await getDb()
            .update(webhookEvents)
            .set({
                status: 'delivered',
                deliveredAt: new Date(),
                attempts: row.attempts + 1,
                lastError: null,
                nextRetryAt: null,
                updatedAt: new Date(),
            })
            .where(eq(webhookEvents.id, row.id))
    } catch (error) {
        const attempts = row.attempts + 1
        const exhausted = attempts >= MAX_RETRY_ATTEMPTS
        await getDb()
            .update(webhookEvents)
            .set({
                status: exhausted ? 'failed' : 'pending',
                attempts,
                lastError: cleanError(error),
                nextRetryAt: exhausted ? null : new Date(Date.now() + getRetryDelayMs(attempts)),
                updatedAt: new Date(),
            })
            .where(eq(webhookEvents.id, row.id))
    }
}

async function getTemplateForStatus(companyId: string, toStatus: string) {
    const key = `candidate_status_${toStatus}`
    const rows = await getDb()
        .select()
        .from(emailTemplates)
        .where(and(eq(emailTemplates.companyId, companyId), eq(emailTemplates.key, key)))
        .limit(1)
    if (rows.length) return rows[0]

    const defaultSubject =
        toStatus === 'interviewed'
            ? `Interview stage · {{jobTitle}}`
            : `Application status updated: ${toStatus}`
    const defaultBody =
        toStatus === 'interviewed'
            ? '<p>Hi {{candidateName}},</p><p>Your application for <b>{{jobTitle}}</b> has moved to <b>interview</b>.</p>{{schedulingLinkHtml}}<p>Thanks,<br/>{{companyName}}</p>'
            : '<p>Hi {{candidateName}},</p><p>Your application for {{jobTitle}} is now in <b>{{status}}</b> stage.</p><p>Thanks,<br/>{{companyName}}</p>'

    return {
        id: '',
        companyId,
        key,
        subject: defaultSubject,
        bodyHtml: defaultBody,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    }
}

async function queueEmailEvent(
    event: CandidateStatusChangedEvent,
    scheduling?: { schedulingLink: string; schedulingLinkHtml: string }
) {
    const template = await getTemplateForStatus(event.companyId, event.toStatus)
    if (!template.enabled) return null

    const companyRows = await getDb()
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, event.companyId))
        .limit(1)
    const companyName = companyRows[0]?.name ?? 'RecruitAI'

    const values: Record<string, string> = {
        candidateName: event.candidateName,
        candidateEmail: event.candidateEmail,
        jobTitle: event.jobTitle,
        status: event.toStatus,
        companyName,
        schedulingLink: scheduling?.schedulingLink ?? '',
        schedulingLinkHtml: scheduling?.schedulingLinkHtml ?? '',
    }

    const subject = renderTemplate(template.subject, values)
    const bodyHtml = renderTemplate(template.bodyHtml, values)

    const [created] = await getDb()
        .insert(emailEvents)
        .values({
            companyId: event.companyId,
            candidateId: event.candidateId,
            jobId: event.jobId,
            templateKey: template.key,
            recipientEmail: event.candidateEmail,
            subject,
            bodyHtml,
            status: 'pending',
        })
        .returning({ id: emailEvents.id })

    return created.id
}

function parseBoolean(value: string | undefined): boolean {
    if (!value) return false
    const normalized = value.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function parseEnvSmtpConfig(): SmtpConfig | null {
    const host = process.env.SMTP_HOST?.trim()
    const user = process.env.SMTP_USER?.trim()
    const pass = process.env.SMTP_PASS
    const fromEmail = process.env.SMTP_FROM_EMAIL?.trim()
    if (!host || !user || !pass || !fromEmail) return null
    return {
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: parseBoolean(process.env.SMTP_SECURE),
        user,
        pass,
        fromEmail,
        fromName: process.env.SMTP_FROM_NAME?.trim() || undefined,
    }
}

async function resolveSmtpConfig(): Promise<SmtpResolvedConfig> {
    const envEnabled = parseBoolean(process.env.SMTP_ENABLED)
    const envConfig = parseEnvSmtpConfig()
    if (envEnabled && envConfig) {
        return {
            enabled: true,
            source: 'env',
            config: envConfig,
        }
    }

    return {
        enabled: false,
        source: 'env',
        config: null,
    }
}

async function attemptEmailDelivery(eventId: string): Promise<void> {
    const rows = await getDb()
        .select()
        .from(emailEvents)
        .where(eq(emailEvents.id, eventId))
        .limit(1)
    if (!rows.length) return
    const row = rows[0]

    const resolved = await resolveSmtpConfig()
    if (!resolved.enabled || !resolved.config) {
        await getDb()
            .update(emailEvents)
            .set({
                status: 'failed',
                attempts: row.attempts + 1,
                lastError:
                    'SMTP is not configured. Set SMTP_ENABLED=true with SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM_EMAIL env vars.',
                nextRetryAt: null,
                updatedAt: new Date(),
            })
            .where(eq(emailEvents.id, row.id))
        return
    }

    try {
        const messageId = await sendSmtpMail(resolved.config, row.recipientEmail, row.subject, row.bodyHtml)
        await getDb()
            .update(emailEvents)
            .set({
                status: 'sent',
                attempts: row.attempts + 1,
                providerMessageId: messageId,
                lastError: null,
                sentAt: new Date(),
                nextRetryAt: null,
                updatedAt: new Date(),
            })
            .where(eq(emailEvents.id, row.id))
    } catch (error) {
        const attempts = row.attempts + 1
        const exhausted = attempts >= MAX_RETRY_ATTEMPTS
        await getDb()
            .update(emailEvents)
            .set({
                status: exhausted ? 'failed' : 'pending',
                attempts,
                lastError: cleanError(error),
                nextRetryAt: exhausted ? null : new Date(Date.now() + getRetryDelayMs(attempts)),
                updatedAt: new Date(),
            })
            .where(eq(emailEvents.id, row.id))
    }
}

export async function handleCandidateStatusChanged(event: CandidateStatusChangedEvent): Promise<void> {
    if (event.fromStatus === event.toStatus) return

    try {
        if (event.toStatus === 'hired' && (await companyHasActiveGenericWebhook(event.companyId))) {
            const webhookEventId = await queueWebhookEvent(event)
            await attemptWebhookDelivery(webhookEventId)
        }
    } catch (error) {
        console.error('HRIS webhook dispatch failed', error)
    }

    let interviewScheduling: { schedulingLink: string; schedulingLinkHtml: string } | undefined
    if (event.toStatus === 'interviewed') {
        const url = await ensureSchedulingInviteLinkForInterview({
            companyId: event.companyId,
            candidateId: event.candidateId,
            jobId: event.jobId,
        })
        if (url) {
            const hrefSafe = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
            interviewScheduling = {
                schedulingLink: url,
                schedulingLinkHtml: `<p><a href="${hrefSafe}">Book your interview time</a></p>`,
            }
        } else {
            interviewScheduling = {
                schedulingLink: '',
                schedulingLinkHtml: '<p>Our team will follow up with scheduling details.</p>',
            }
        }
    }

    try {
        const maybeSmtp = await resolveSmtpConfig()
        if (maybeSmtp.enabled) {
            const emailEventId = await queueEmailEvent(event, interviewScheduling)
            if (emailEventId) await attemptEmailDelivery(emailEventId)
        }
    } catch (error) {
        console.error('Candidate email dispatch failed', error)
    }
}

export async function retryPendingWebhookEvents(companyId: string, limit = 20): Promise<number> {
    const rows = await getDb()
        .select({ id: webhookEvents.id })
        .from(webhookEvents)
        .where(
            and(
                eq(webhookEvents.companyId, companyId),
                eq(webhookEvents.status, 'pending'),
                or(lte(webhookEvents.nextRetryAt, new Date()), isNull(webhookEvents.nextRetryAt))
            )
        )
        .limit(limit)

    for (const row of rows) {
        await attemptWebhookDelivery(row.id)
    }

    return rows.length
}

export async function retryPendingEmailEvents(companyId: string, limit = 20): Promise<number> {
    const rows = await getDb()
        .select({ id: emailEvents.id })
        .from(emailEvents)
        .where(
            and(
                eq(emailEvents.companyId, companyId),
                eq(emailEvents.status, 'pending'),
                or(lte(emailEvents.nextRetryAt, new Date()), isNull(emailEvents.nextRetryAt))
            )
        )
        .limit(limit)

    for (const row of rows) {
        await attemptEmailDelivery(row.id)
    }

    return rows.length
}

