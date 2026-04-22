'use server'

import { companies } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath, unstable_noStore } from 'next/cache'
import { getDb } from '@/lib/db/drizzle-client'
import { getCurrentUserIdOrNull, requireCurrentUserId, requireOwnedCompanyId } from '@/lib/actions/auth-context'

export async function getCompany() {
    unstable_noStore()
    try {
        const userId = await getCurrentUserIdOrNull()
        if (!userId) return null

        const rows = await getDb().select().from(companies).where(eq(companies.ownerId, userId)).limit(1)
        return rows.length ? rows[0] : null
    } catch {
        return null
    }
}

export async function updateCompany(formData: { name?: string }) {
    try {
        const userId = await requireCurrentUserId()
        const companyId = await requireOwnedCompanyId(userId)

        if (formData.name === undefined) return
        await getDb().update(companies).set({ name: formData.name }).where(eq(companies.id, companyId))
        revalidatePath('/dashboard/settings')
    } catch (e) {
        if (e instanceof Error) throw e
        throw new Error('Failed to update company')
    }
}
