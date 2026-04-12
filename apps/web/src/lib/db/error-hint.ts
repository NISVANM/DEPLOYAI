/** Drizzle wraps failures in DrizzleQueryError; Postgres code/message live on `.cause`. */
function unwrapPgError(e: unknown): { message: string; code?: string } {
    if (!(e instanceof Error)) {
        return { message: String(e) }
    }
    const cause = (e as Error & { cause?: unknown }).cause
    if (cause instanceof Error) {
        const code = (cause as { code?: string }).code
        return { message: cause.message, code }
    }
    return { message: e.message, code: (e as { code?: string }).code }
}

/** Map Postgres / connection errors to safe, actionable UI hints (no secrets). */
export function databaseErrorHint(e: unknown): string {
    const { message: msg, code } = unwrapPgError(e)

    if (msg.includes('DATABASE_URL is not set') || msg.includes('not set')) {
        return 'DATABASE_URL is missing. Add it to .env.local (local) or Vercel → Environment Variables (production), then restart / redeploy.'
    }
    if (code === '42P01' || /relation .+ does not exist/i.test(msg) || /table .+ does not exist/i.test(msg)) {
        return 'Tables are missing in Postgres. Open Supabase → SQL Editor (same project as DATABASE_URL), run apps/web/supabase/schema.sql then rls.sql, then try again.'
    }
    if (code === '42703' || /column .+ does not exist/i.test(msg)) {
        return 'Schema mismatch: a column is missing. Re-run apps/web/supabase/schema.sql in Supabase SQL Editor or reset dev DB to match the repo.'
    }
    if (code === '28P01' || msg.toLowerCase().includes('password authentication failed')) {
        return 'DATABASE_URL password is wrong. Reset DB password in Supabase → Settings → Database, update DATABASE_URL (URL-encode special chars in password).'
    }
    if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
        return 'DATABASE_URL host is invalid. Project ref must match your Supabase project (same as NEXT_PUBLIC_SUPABASE_URL).'
    }
    if (
        msg.includes('CONNECT_TIMEOUT') ||
        msg.includes('write CONNECT_TIMEOUT') ||
        msg.includes('connect timeout') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('ECONNREFUSED') ||
        /timeout/i.test(msg)
    ) {
        if (msg.includes('pooler.supabase.com')) {
            return [
                'Postgres connection timed out (pooler already in use). Try:',
                '1) Open Supabase dashboard — if the project is paused (free tier), restore it.',
                '2) Turn off VPN / try another network (e.g. phone hotspot); some Wi‑Fi blocks outbound DB ports.',
                '3) In Supabase → Database, try Session mode URI (port 5432 on …pooler…) as DATABASE_URL.',
                'Optional: set DATABASE_CONNECT_TIMEOUT_SEC=90 in .env.local and restart.',
            ].join(' ')
        }
        return 'Database connection timed out. Use Supabase Transaction pooler URI (port 6543, …pooler.supabase.com) in DATABASE_URL. If still timing out: resume project in dashboard, disable VPN, or try Session pooler (port 5432).'
    }
    if (msg.includes('SSL') || msg.includes('certificate')) {
        return 'SSL connection issue. Use the URI from Supabase → Database; add ?sslmode=require if needed.'
    }

    const short = msg.replace(/postgres:\/\/[^@\s]+@/gi, 'postgres://***@').slice(0, 200)
    return short.length >= 200 ? `${short}…` : short
}
