'use server'

import { jobs, candidates, companies } from '@/lib/db/schema'
import { unstable_noStore } from 'next/cache'
import { count, eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle-client'
import { getCurrentUserIdOrNull } from '@/lib/actions/auth-context'

const emptyStats = { jobsCount: 0, candidatesCount: 0, screenedCount: 0, interviewCount: 0 }

export async function getDashboardStats() {
    unstable_noStore()
    try {
        const userId = await getCurrentUserIdOrNull()
        if (!userId) return emptyStats

        const userCompanies = await getDb().select({ id: companies.id })
            .from(companies)
            .where(eq(companies.ownerId, userId))
            .limit(1)

        if (!userCompanies.length) return emptyStats

        const companyId = userCompanies[0].id

        const [jobsCount, candidatesCount, interviewCount] = await Promise.all([
            getDb().select({ count: count() })
                .from(jobs)
                .where(eq(jobs.companyId, companyId)),
            getDb().select({ count: count() })
                .from(candidates)
                .where(eq(candidates.companyId, companyId)),
            getDb().select({ count: count() })
                .from(candidates)
                .where(and(eq(candidates.companyId, companyId), eq(candidates.status, 'interviewed'))),
        ])

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
