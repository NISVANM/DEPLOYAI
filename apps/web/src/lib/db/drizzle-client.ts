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

function createSql() {
    const url = normalizeDatabaseUrl(process.env.DATABASE_URL)
    if (!url) {
        throw new Error('DATABASE_URL is not set')
    }
    const needsSsl =
        url.includes('supabase.co') ||
        url.includes('pooler.supabase.com') ||
        url.includes('amazonaws.com')

    return postgres(url, {
        max: 1,
        connect_timeout: 15,
        idle_timeout: 20,
        prepare: false,
        ssl: needsSsl ? 'require' : false,
    })
}

const globalForSql = globalThis as unknown as { __deployaiSql?: ReturnType<typeof postgres> }

export const sql =
    globalForSql.__deployaiSql ??
    createSql()

if (process.env.NODE_ENV !== 'production') {
    globalForSql.__deployaiSql = sql
}

export const db = drizzle(sql)
