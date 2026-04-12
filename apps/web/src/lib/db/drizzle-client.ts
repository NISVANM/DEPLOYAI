/**
 * Drizzle over postgres.js — works with Supabase **Transaction pooler** (port 6543) on Vercel.
 * node-postgres (`pg`) uses prepared statements by default; PgBouncer transaction mode rejects them → generic DB errors.
 */
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'

function normalizeDatabaseUrl(raw: string | undefined): string {
    let url = raw?.trim() ?? ''
    // Vercel users often paste `"postgresql://..."` — quotes break the connection
    if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
        url = url.slice(1, -1).trim()
    }
    return url
}

function validateConnectionString(url: string): void {
    if (!url) {
        throw new Error(
            'DATABASE_URL is not set. Add it to apps/web/.env.local (or Vercel env) and restart the dev server.'
        )
    }
    if (url.includes('\n') || url.includes('\r')) {
        throw new Error(
            'DATABASE_URL must be one line in .env.local — remove line breaks inside the URL. Copy the full string from Supabase in one go.'
        )
    }
    if (!/^postgres(ql)?:\/\//i.test(url)) {
        throw new Error(
            'DATABASE_URL must start with postgresql:// or postgres:// (check for typos or a missing protocol).'
        )
    }
}

function createSql() {
    const url = normalizeDatabaseUrl(process.env.DATABASE_URL)
    validateConnectionString(url)

    const needsSsl =
        url.includes('supabase.co') ||
        url.includes('pooler.supabase.com') ||
        url.includes('amazonaws.com')

    const connectTimeoutSec = Math.min(
        120,
        Math.max(10, Number(process.env.DATABASE_CONNECT_TIMEOUT_SEC) || 45)
    )

    try {
        return postgres(url, {
            max: 1,
            connect_timeout: connectTimeoutSec,
            idle_timeout: 20,
            prepare: false,
            ssl: needsSsl ? 'require' : false,
        })
    } catch (e) {
        if (e instanceof TypeError && String(e.message).includes('Invalid URL')) {
            throw new Error(
                'DATABASE_URL is not a valid connection string. Copy the URI from Supabase → Settings → Database (Transaction pooler). If the password has @ # or spaces, URL-encode it. In .env.local use DATABASE_URL=postgresql://... with no quotes.'
            )
        }
        throw e
    }
}

const globalForDb = globalThis as unknown as {
    __deployaiDrizzle?: ReturnType<typeof drizzle>
}

function getDrizzle() {
    if (globalForDb.__deployaiDrizzle) {
        return globalForDb.__deployaiDrizzle
    }
    const sql = createSql()
    const instance = drizzle(sql)
    globalForDb.__deployaiDrizzle = instance
    return instance
}

/** Lazy init so a bad DATABASE_URL does not crash the whole app at import time. */
export function getDb() {
    return getDrizzle()
}
