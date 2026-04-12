'use server'

import { createClient } from '@/lib/supabase-server'
import { jobs, candidates, companies } from '@/lib/db/schema'
import { unstable_noStore } from 'next/cache'
import { count, eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle-client'

const emptyStats = { jobsCount: 0, candidatesCount: 0, screenedCount: 0, interviewCount: 0 }

export async function getDashboardStats() {
    unstable_noStore()
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return emptyStats

        const userCompanies = await getDb().select({ id: companies.id })
            .from(companies)
            .where(eq(companies.ownerId, user.id))
            .limit(1)

        if (!userCompanies.length) return emptyStats

        const companyId = userCompanies[0].id

        const jobsCount = await getDb().select({ count: count() })
            .from(jobs)
            .where(eq(jobs.companyId, companyId))

        const candidatesCount = await getDb().select({ count: count() })
            .from(candidates)
            .where(eq(candidates.companyId, companyId))

        const screenedCount = await getDb().select({ count: count() })
            .from(candidates)
            .where(eq(candidates.companyId, companyId))

        const interviewCount = await getDb().select({ count: count() })
            .from(candidates)
            .where(and(eq(candidates.companyId, companyId), eq(candidates.status, 'interviewed')))

        return {
            jobsCount: jobsCount[0].count,
            candidatesCount: candidatesCount[0].count,
            screenedCount: candidatesCount[0].count,
            interviewCount: interviewCount[0].count
        }
    } catch {
        return emptyStats
    }
}
