/** Map Postgres / connection errors to safe, actionable UI hints (no secrets). */
export function databaseErrorHint(e: unknown): string {
    if (!(e instanceof Error)) {
        return 'Database error. Redeploy from latest GitHub commit; check Vercel → DATABASE_URL.'
    }
    const msg = e.message
    const code = (e as { code?: string }).code

    if (msg.includes('DATABASE_URL is not set') || msg.includes('not set')) {
        return 'DATABASE_URL is missing in Vercel. Add it under Settings → Environment Variables for Production, then Redeploy.'
    }
    if (code === '42P01' || msg.includes('does not exist')) {
        return 'Database tables missing. In Supabase → SQL Editor, run apps/web/supabase/schema.sql then rls.sql.'
    }
    if (code === '28P01' || msg.toLowerCase().includes('password authentication failed')) {
        return 'DATABASE_URL password is wrong. Reset DB password in Supabase → Settings → Database, update Vercel DATABASE_URL (URL-encode special chars in password).'
    }
    if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
        return 'DATABASE_URL host is invalid. Project ref in the URL must match your Supabase project (same as NEXT_PUBLIC_SUPABASE_URL).'
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('timeout')) {
        return 'Cannot reach Postgres. In Vercel use Supabase Transaction pooler URI (port 6543), not direct :5432, then Redeploy.'
    }
    if (msg.includes('SSL') || msg.includes('certificate')) {
        return 'SSL connection issue. Use the connection string from Supabase → Database (URI), with ?sslmode=require if needed.'
    }

    const short = msg.replace(/postgres:\/\/[^@\s]+@/gi, 'postgres://***@').slice(0, 200)
    return short.length >= 200 ? `${short}…` : short
}
