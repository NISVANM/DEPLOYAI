/**
 * Cal.com integration — API v2 for validation, hosted booking UI for scheduling.
 * @see https://cal.com/docs/api-reference/v2/event-types/get-all-event-types
 */

export const CALCOM_EVENT_TYPES_API_VERSION = '2024-06-14'

/** Required for `GET /v2/bookings` — see Cal.com bookings API docs */
export const CALCOM_BOOKINGS_API_VERSION = '2026-02-25'

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

export type CalcomBookingListItem = {
    id: number
    uid?: string
    status: string
    start: string
    createdAt: string
    attendees?: Array<{ email?: string }>
}

/**
 * Recent bookings for matching to scheduling invites (server-only).
 * Uses Cal.com API v2 — requires a valid API key with booking read access.
 */
export async function calcomFetchRecentBookings(
    apiKey: string,
    apiBaseUrl: string | undefined,
    opts: {
        /** Only bookings created on or after this instant (e.g. oldest invite minus buffer) */
        afterCreatedAt: Date
        take?: number
        /** When set, limits to this event type (recommended if you have many event types) */
        eventTypeId?: number
    }
): Promise<CalcomBookingListItem[]> {
    const base = normalizeCalcomApiBase(apiBaseUrl)
    const url = new URL(`${base}/v2/bookings`)
    url.searchParams.set('afterCreatedAt', opts.afterCreatedAt.toISOString())
    url.searchParams.set('take', String(opts.take ?? 100))
    url.searchParams.set('sortCreated', 'asc')
    if (opts.eventTypeId != null && Number.isFinite(opts.eventTypeId)) {
        url.searchParams.set('eventTypeId', String(opts.eventTypeId))
    }
    const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
            'cal-api-version': CALCOM_BOOKINGS_API_VERSION,
        },
        cache: 'no-store',
    })
    const text = await res.text()
    if (!res.ok) {
        throw new Error(`Cal.com bookings ${res.status}: ${text.slice(0, 500)}`)
    }
    let parsed: { data?: unknown[] }
    try {
        parsed = JSON.parse(text) as { data?: unknown[] }
    } catch {
        throw new Error('Cal.com returned invalid JSON for bookings')
    }
    const raw = Array.isArray(parsed.data) ? parsed.data : []
    const out: CalcomBookingListItem[] = []
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue
        const row = item as Record<string, unknown>
        const id = typeof row.id === 'number' ? row.id : Number(row.id)
        if (!Number.isFinite(id)) continue
        const status = typeof row.status === 'string' ? row.status : ''
        const start = typeof row.start === 'string' ? row.start : ''
        const createdAt = typeof row.createdAt === 'string' ? row.createdAt : ''
        if (!start || !createdAt) continue
        const attendees = Array.isArray(row.attendees) ? (row.attendees as CalcomBookingListItem['attendees']) : undefined
        out.push({
            id,
            uid: typeof row.uid === 'string' ? row.uid : undefined,
            status,
            start,
            createdAt,
            attendees,
        })
    }
    return out
}

/**
 * Match Cal.com bookings to scheduling invite rows by attendee email and invite creation time.
 * Each booking is used at most once; invites are processed in chronological order.
 */
export function matchBookingsToInviteIds<
    T extends { id: string; createdAt: Date; candidateEmail: string },
>(invites: T[], bookings: CalcomBookingListItem[]): Map<string, Date> {
    const sortedInvites = [...invites].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    const byEmail = new Map<string, CalcomBookingListItem[]>()
    for (const b of bookings) {
        if (b.status === 'cancelled' || b.status === 'rejected') continue
        const emails = (b.attendees ?? [])
            .map((a) => (a?.email ?? '').trim().toLowerCase())
            .filter(Boolean)
        for (const em of emails) {
            const list = byEmail.get(em) ?? []
            list.push(b)
            byEmail.set(em, list)
        }
    }
    for (const [, list] of byEmail) {
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }
    const used = new Set<number>()
    const out = new Map<string, Date>()
    for (const inv of sortedInvites) {
        const email = inv.candidateEmail.trim().toLowerCase()
        const list = byEmail.get(email) ?? []
        const hit = list.find(
            (b) =>
                !used.has(b.id) &&
                new Date(b.createdAt).getTime() >= inv.createdAt.getTime()
        )
        if (hit) {
            used.add(hit.id)
            out.set(inv.id, new Date(hit.start))
        }
    }
    return out
}
