'use server'

import { createClient } from '@/lib/supabase-server'
import { jobs, companies, companyMemberships } from '@/lib/db/schema'
import { jobSchema } from '@/lib/schemas/jobs'
import { revalidatePath, unstable_noStore } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db/drizzle-client'

export async function createJob(formData: any) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const result = jobSchema.safeParse(formData)
    if (!result.success) return { error: result.error.flatten() }

    try {
        let companyId: string
        const userCompanies = await db.select({ id: companies.id })
            .from(companies)
            .where(eq(companies.ownerId, user.id))
            .limit(1)

        if (userCompanies.length > 0) {
            companyId = userCompanies[0].id
        } else {
            const [newCompany] = await db.insert(companies).values({
                name: 'My Company',
                slug: `company-${Date.now()}`,
                ownerId: user.id,
            }).returning({ id: companies.id })
            companyId = newCompany.id
            await db.insert(companyMemberships).values({
                companyId,
                userId: user.id,
                role: 'owner'
            })
        }

        await db.insert(jobs).values({
            companyId,
            title: result.data.title,
            description: result.data.description,
            requirements: result.data.requirements,
            skills: result.data.skills,
            minExperience: result.data.minExperience,
            location: result.data.location,
            type: result.data.type,
            status: 'active'
        })

        revalidatePath('/dashboard/jobs')
        redirect('/dashboard/jobs')
    } catch (e) {
        // Next.js redirect() throws a special error; rethrow so the redirect happens
        if (e && typeof e === 'object' && 'digest' in e && String((e as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) {
            throw e
        }
        console.error('createJob error:', e)
        const message = e instanceof Error ? e.message : 'Database error'
        const hint =
            process.env.NODE_ENV === 'development'
                ? message
                : 'Database error. On Vercel: set DATABASE_URL (Supabase → Settings → Database) and run supabase/schema.sql (+ rls.sql) in the Supabase SQL Editor for this project.'
        return { error: { formErrors: [hint] } }
    }
}

export async function getJobs() {
    unstable_noStore()
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []

        const userCompanies = await db.select({ id: companies.id })
            .from(companies)
            .where(eq(companies.ownerId, user.id))
            .limit(1)

        if (!userCompanies.length) return []

        const companyId = userCompanies[0].id
        return await db.select().from(jobs).where(eq(jobs.companyId, companyId)).orderBy(jobs.createdAt)
    } catch {
        return []
    }
}

export async function getJob(jobId: string) {
    unstable_noStore()
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null

        const userCompanies = await db.select({ id: companies.id })
            .from(companies)
            .where(eq(companies.ownerId, user.id))
            .limit(1)
        if (!userCompanies.length) return null

        const companyId = userCompanies[0].id
        const rows = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1)
        if (!rows.length || rows[0].companyId !== companyId) return null
        return rows[0]
    } catch {
        return null
    }
}

export async function deleteJob(jobId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const userCompanies = await db.select({ id: companies.id })
        .from(companies)
        .where(eq(companies.ownerId, user.id))
        .limit(1)
    if (!userCompanies.length) throw new Error('Unauthorized')

    const rows = await db.select({ id: jobs.id, companyId: jobs.companyId }).from(jobs).where(eq(jobs.id, jobId)).limit(1)
    if (!rows.length || rows[0].companyId !== userCompanies[0].id) throw new Error('Job not found or unauthorized')

    await db.delete(jobs).where(eq(jobs.id, jobId))
    revalidatePath('/dashboard/jobs')
    revalidatePath('/dashboard/candidates')
}
