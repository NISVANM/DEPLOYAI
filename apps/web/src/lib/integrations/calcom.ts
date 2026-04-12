/**
 * Cal.com integration — API v2 for validation, hosted booking UI for scheduling.
 * @see https://cal.com/docs/api-reference/v2/event-types/get-all-event-types
 */

export const CALCOM_EVENT_TYPES_API_VERSION = '2024-06-14'

export type CalcomStoredConfig = {
    /** API key (cal_live_* / cal_test_*). Server-only; never send to the client. */
    apiKey?: string
    /** Default https://api.cal.com — use your self-hosted API origin if applicable */
    apiBaseUrl?: string
    /** Default https://cal.com — use your self-hosted app origin if applicable */
    bookingBaseUrl?: string
    /** Cal.com username (path segment before event slug) */
    username: string
    /** Event type slug, e.g. 30min */
    eventSlug: string
    /** Optional: from API list response for your own reference */
    eventTypeId?: number
    organizationSlug?: string
    teamSlug?: string
}

export function normalizeCalcomApiBase(url?: string): string {
    return (url ?? 'https://api.cal.com').trim().replace(/\/$/, '')
}

export function normalizeCalcomBookingBase(url?: string): string {
    return (url ?? 'https://cal.com').trim().replace(/\/$/, '')
}

export async function calcomFetchEventTypes(
    apiKey: string,
    apiBaseUrl: string | undefined,
    query: { username?: string }
): Promise<{ status: string; data: Array<{ id: number; slug: string; title: string }> }> {
    const base = normalizeCalcomApiBase(apiBaseUrl)
    const url = new URL(`${base}/v2/event-types`)
    if (query.username) url.searchParams.set('username', query.username.trim())
    const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
            'cal-api-version': CALCOM_EVENT_TYPES_API_VERSION,
        },
        cache: 'no-store',
    })
    const text = await res.text()
    if (!res.ok) {
        throw new Error(`Cal.com API ${res.status}: ${text.slice(0, 500)}`)
    }
    try {
        return JSON.parse(text) as { status: string; data: Array<{ id: number; slug: string; title: string }> }
    } catch {
        throw new Error('Cal.com returned invalid JSON')
    }
}

/**
 * Public booking page where the candidate picks a time (Cal.com UI).
 * Prefills name/email when supported by the deployment.
 */
export function buildCalcomBookingPageUrl(opts: {
    bookingBaseUrl?: string
    username: string
    eventSlug: string
    attendeeEmail?: string
    attendeeName?: string
}): string {
    const base = normalizeCalcomBookingBase(opts.bookingBaseUrl)
    const path = `${encodeURIComponent(opts.username.trim())}/${encodeURIComponent(opts.eventSlug.trim())}`
    const url = new URL(`${base}/${path}`)
    if (opts.attendeeName) url.searchParams.set('name', opts.attendeeName)
    if (opts.attendeeEmail) url.searchParams.set('email', opts.attendeeEmail)
    return url.toString()
}

export function calcomConfigReadyForLinks(cal: CalcomStoredConfig | null | undefined): boolean {
    if (!cal) return false
    return Boolean(String(cal.username ?? '').trim() && String(cal.eventSlug ?? '').trim())
}
