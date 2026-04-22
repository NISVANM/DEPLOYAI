'use server'

import { and, desc, eq, ilike, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle-client'
import { candidates, companies, jobs } from '@/lib/db/schema'
import { getCurrentUserIdOrNull } from '@/lib/actions/auth-context'

export type DashboardSearchResult = {
    jobs: Array<{
        id: string
        title: string
        location: string | null
        type: string | null
    }>
    candidates: Array<{
        id: string
        name: string
        email: string
        jobId: string
        jobTitle: string
        score: number | null
    }>
}

export async function searchDashboardEntities(query: string): Promise<DashboardSearchResult> {
    const q = query.trim()
    if (q.length < 2) return { jobs: [], candidates: [] }

    const userId = await getCurrentUserIdOrNull()
    if (!userId) return { jobs: [], candidates: [] }

    const companyRows = await getDb()
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.ownerId, userId))
        .limit(1)
    const companyId = companyRows[0]?.id
    if (!companyId) return { jobs: [], candidates: [] }

    const like = `%${q}%`

    const [jobRows, candidateRows] = await Promise.all([
        getDb()
            .select({
                id: jobs.id,
                title: jobs.title,
                location: jobs.location,
                type: jobs.type,
            })
            .from(jobs)
            .where(
                and(
                    eq(jobs.companyId, companyId),
                    or(ilike(jobs.title, like), ilike(jobs.location, like), ilike(jobs.type, like))
                )
            )
            .orderBy(desc(jobs.createdAt))
            .limit(8),
        getDb()
            .select({
                id: candidates.id,
                name: candidates.name,
                email: candidates.email,
                score: candidates.score,
                jobId: candidates.jobId,
                jobTitle: jobs.title,
            })
            .from(candidates)
            .innerJoin(jobs, eq(candidates.jobId, jobs.id))
            .where(
                and(
                    eq(candidates.companyId, companyId),
                    or(ilike(candidates.name, like), ilike(candidates.email, like), ilike(jobs.title, like))
                )
            )
            .orderBy(desc(candidates.createdAt))
            .limit(8),
    ])

    return {
        jobs: jobRows,
        candidates: candidateRows,
    }
}
