'use server'

import { createClient } from '@/lib/supabase-server'
import { companies } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath, unstable_noStore } from 'next/cache'
import { db } from '@/lib/db/drizzle-client'

export async function getCompany() {
    unstable_noStore()
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null

        const rows = await db.select().from(companies).where(eq(companies.ownerId, user.id)).limit(1)
        return rows.length ? rows[0] : null
    } catch {
        return null
    }
}

export async function updateCompany(formData: { name?: string }) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Unauthorized')

        const rows = await db.select({ id: companies.id }).from(companies).where(eq(companies.ownerId, user.id)).limit(1)
        if (!rows.length) throw new Error('Company not found')

        if (formData.name === undefined) return
        await db.update(companies).set({ name: formData.name }).where(eq(companies.id, rows[0].id))
        revalidatePath('/dashboard/settings')
    } catch (e) {
        if (e instanceof Error) throw e
        throw new Error('Failed to update company')
    }
}
