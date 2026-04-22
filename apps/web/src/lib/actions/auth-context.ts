'use server'

import { eq } from 'drizzle-orm'
import { cache } from 'react'
import { createClient } from '@/lib/supabase-server'
import { getDb } from '@/lib/db/drizzle-client'
import { companies } from '@/lib/db/schema'

const getCurrentUserIdCached = cache(async (): Promise<string | null> => {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    return user?.id ?? null
})

export async function getCurrentUserIdOrNull(): Promise<string | null> {
    return getCurrentUserIdCached()
}

export async function requireCurrentUserId(): Promise<string> {
    const userId = await getCurrentUserIdOrNull()
    if (!userId) throw new Error('Unauthorized')
    return userId
}

export async function getOwnedCompanyIdOrNull(userId: string): Promise<string | null> {
    const rows = await getDb()
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.ownerId, userId))
        .limit(1)
    return rows[0]?.id ?? null
}

export async function requireOwnedCompanyId(userId: string): Promise<string> {
    const companyId = await getOwnedCompanyIdOrNull(userId)
    if (!companyId) throw new Error('Company not found')
    return companyId
}
