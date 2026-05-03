'use server'

import { createClient } from '@/lib/supabase-server'
import { candidates, jobs, companies } from '@/lib/db/schema'
import { revalidatePath, unstable_noStore } from 'next/cache'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/drizzle-client'
import { GoogleGenerativeAI } from '@google/generative-ai'
import mammoth from 'mammoth'
import { extractTextFromPdfBuffer } from '@/lib/pdf-extract'
import { handleCandidateStatusChanged } from '@/lib/integrations/dispatcher'
import type { CandidateStatus } from '@/lib/integrations/types'
import { getCurrentUserIdOrNull, requireCurrentUserId } from '@/lib/actions/auth-context'
import { decodeJobSkills, findMissingRequiredSkills } from '@/lib/job-skills'
import {
    buildCandidateImprovementPlan,
    flattenImprovementPlan,
} from '@/lib/candidate-improvement-suggestions'

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

type AiResume = {
    name?: string
    email?: string
    phone?: string
    skills?: string[]
    summary?: string
    experience_years?: number
    education?: unknown
    work_experience?: unknown[]
    projects?: unknown[]
    certifications?: unknown[]
    languages?: unknown[]
    awards_honors?: unknown[]
    publications?: unknown[]
    volunteer_experience?: unknown[]
    interests?: unknown[]
    additional_info?: string
    score?: number
    match_analysis?: unknown
}

function clampScore(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)))
}

function normalizeSkill(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9+#.\- ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function toSkillSet(values: unknown): Set<string> {
    if (!Array.isArray(values)) return new Set()
    const normalized = values
        .map((v) => (typeof v === 'string' ? normalizeSkill(v) : ''))
        .filter(Boolean)
    return new Set(normalized)
}

function inferYearsOfExperience(parsed: AiResume, resumeText: string): number {
    if (typeof parsed.experience_years === 'number' && Number.isFinite(parsed.experience_years)) {
        return Math.max(0, parsed.experience_years)
    }
    const direct = resumeText.match(/(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)/i)
    if (direct) return Math.max(0, Number(direct[1]) || 0)
    return 0
}

function createDeterministicAnalysis(params: {
    parsed: AiResume
    resumeText: string
    jobTitle: string
    requiredSkills: string[]
    minExperience: number
}): { score: number; strengths: string[]; weaknesses: string[]; reasoning: string } {
    const { parsed, resumeText, jobTitle, requiredSkills, minExperience } = params
    const resumeTextLower = resumeText.toLowerCase()
    const candidateSkills = toSkillSet(parsed.skills)
    const normalizedRequiredSkills = requiredSkills.map(normalizeSkill).filter(Boolean)

    const matchedRequiredSkills = normalizedRequiredSkills.filter((skill) => {
        if (candidateSkills.has(skill)) return true
        return resumeTextLower.includes(skill)
    })

    const requiredSkillCoverage = normalizedRequiredSkills.length
        ? matchedRequiredSkills.length / normalizedRequiredSkills.length
        : 0.5

    const inferredExperience = inferYearsOfExperience(parsed, resumeText)
    const minExp = Math.max(0, minExperience || 0)
    const experienceCoverage = minExp > 0 ? Math.min(1, inferredExperience / minExp) : 1

    const titleTokens = jobTitle
        .toLowerCase()
        .split(/[^a-z0-9+.#-]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 4)
    const titleMatches = titleTokens.filter((token) => resumeTextLower.includes(token)).length
    const titleCoverage = titleTokens.length ? titleMatches / titleTokens.length : 0.6

    const deterministicScore = clampScore(
        requiredSkillCoverage * 60 +
            experienceCoverage * 30 +
            titleCoverage * 10
    )

    const strengths: string[] = []
    const weaknesses: string[] = []
    if (matchedRequiredSkills.length > 0) {
        strengths.push(`Matched ${matchedRequiredSkills.length}/${normalizedRequiredSkills.length || 0} required skills`)
    }
    if (inferredExperience >= minExp) {
        strengths.push(`Meets experience baseline (${inferredExperience} years vs required ${minExp})`)
    } else if (minExp > 0) {
        weaknesses.push(`Experience appears below requirement (${inferredExperience} years vs required ${minExp})`)
    }
    if (normalizedRequiredSkills.length && matchedRequiredSkills.length < normalizedRequiredSkills.length) {
        const missing = normalizedRequiredSkills
            .filter((s) => !matchedRequiredSkills.includes(s))
            .slice(0, 4)
        if (missing.length) weaknesses.push(`Potential missing skills: ${missing.join(', ')}`)
    }
    if (!strengths.length) strengths.push('Resume includes relevant background for the role')

    return {
        score: deterministicScore,
        strengths,
        weaknesses,
        reasoning: `Score blends required skill coverage (${Math.round(requiredSkillCoverage * 100)}%), experience fit (${Math.round(experienceCoverage * 100)}%), and role relevance (${Math.round(titleCoverage * 100)}%).`,
    }
}

function extractFallbackParsed(params: {
    resumeText: string
    requiredSkills: string[]
}): AiResume {
    const { resumeText, requiredSkills } = params
    const lines = resumeText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

    const firstLine = lines[0] ?? 'Unknown Candidate'
    const emailMatch = resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    const phoneMatch = resumeText.match(/(?:\+?\d[\d()\-\s]{7,}\d)/)

    const resumeLower = resumeText.toLowerCase()
    const matchedSkills = requiredSkills.filter((skill) => {
        const normalized = normalizeSkill(skill)
        return normalized.length > 0 && resumeLower.includes(normalized)
    })

    return {
        name: firstLine.slice(0, 120),
        email: emailMatch?.[0],
        phone: phoneMatch?.[0],
        skills: matchedSkills,
        summary: lines.slice(0, 6).join(' ').slice(0, 900),
        match_analysis: {
            strengths: [],
            weaknesses: [],
            reasoning: 'Generated from resume text using fallback analysis because AI parsing was unavailable.',
        },
    }
}

async function processSingleResume(params: {
    file: File
    jobId: string
    jobData: typeof jobs.$inferSelect
    supabase: Awaited<ReturnType<typeof createClient>>
}): Promise<{ success: true } | { success: false; error: string }> {
    const { file, jobId, jobData, supabase } = params
    const decodedJobSkills = decodeJobSkills(jobData.skills)
    const requiredSkills = decodedJobSkills.requiredSkills
    if (!(file instanceof File) || file.size === 0) {
        return { success: false, error: 'Invalid or empty file' }
    }

    // 1. Start upload to Supabase Storage (in parallel with extraction)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filename = `${jobId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`
    const uploadPromise = supabase.storage
        .from('resumes')
        .upload(filename, file)

    // 2. Extract Text while upload is in-flight
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    let text = ''

    if (file.type === 'application/pdf') {
        try {
            text = await extractTextFromPdfBuffer(buffer)
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            return { success: false, error: `Could not read this PDF (${msg}). Try re-exporting the file or use DOCX.` }
        }
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
    } else {
        text = buffer.toString('utf-8')
    }

    const { data: uploadData, error: uploadError } = await uploadPromise
    if (uploadError) {
        console.error('Upload Error:', uploadError)
    }

    const resumeUrl = uploadData?.path
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/resumes/${uploadData.path}`
        : null

    // 3. AI Parse & Score (Groq first if configured; then Gemini; deterministic fallback if unavailable)

    // Model must be available in your Google AI Studio / API key. Fallback to gemini-pro if primary returns 404.
    const modelIds = process.env.GEMINI_MODEL
        ? [process.env.GEMINI_MODEL, 'gemini-2.0-flash', 'gemini-pro']
        : ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-pro']
    const prompt = `
    You are an expert recruiter. Extract candidate information from the resume text below and structure it into JSON.
    Also score the candidate from 0-100 based on the Job Requirements.
    
    Job Context:
    - Title: ${jobData.title}
    - Description: ${jobData.description}
    - Skills: ${decodedJobSkills.allSkills.join(', ')}
    - Must-have skills (strict): ${requiredSkills.join(', ')}
    - Min Experience: ${jobData.minExperience} years

    Resume Text:
    ${text.substring(0, 10000)}
    
    Return strict JSON with this structure (use empty arrays [] or omit optional sections if not present in the resume):
    {
        "name": "string",
        "email": "string",
        "phone": "string",
        "skills": ["skill1", "skill2"],
        "experience_years": number,
        "education": [{"degree": "string", "school": "string", "year": "string"}],
        "summary": "string",
        "work_experience": [
            {"company": "string", "title": "string", "location": "string", "start": "string", "end": "string", "description": "string"}
        ],
        "projects": [
            {"name": "string", "description": "string", "technologies": ["string"], "link": "string"}
        ],
        "certifications": [
            {"name": "string", "issuer": "string", "date": "string", "credential_id": "string"}
        ],
        "languages": [{"language": "string", "proficiency": "string"}],
        "awards_honors": [{"title": "string", "issuer": "string", "year": "string"}],
        "publications": [{"title": "string", "venue": "string", "year": "string"}],
        "volunteer_experience": [
            {"organization": "string", "role": "string", "description": "string", "start": "string", "end": "string"}
        ],
        "interests": ["string"],
        "additional_info": "string",
        "score": number,
        "match_analysis": {
            "strengths": ["string"],
            "weaknesses": ["string"],
            "reasoning": "string"
        }
    }
  `

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    let content: string | null = null
    let lastError: Error | null = null

    // Try Groq first (free tier, generous limits: 30 RPM / 14.4K RPD for llama-3.1-8b-instant)
    if (process.env.GROQ_API_KEY) {
        try {
            const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                },
                body: JSON.stringify({
                    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
                    messages: [
                        { role: 'system', content: 'You are an expert recruiter. Always respond with valid JSON only, no markdown.' },
                        { role: 'user', content: prompt },
                    ],
                    max_tokens: 4096,
                    temperature: 0.2,
                    response_format: { type: 'json_object' },
                }),
            })
            if (groqRes.ok) {
                const data = (await groqRes.json()) as { choices?: Array<{ message?: { content?: string } }> }
                content = data.choices?.[0]?.message?.content?.trim() ?? null
            }
        } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e))
        }
    }

    const isGeminiAccessIssue = (message: string) => {
        const msg = message.toLowerCase()
        return (
            msg.includes('403') ||
            msg.includes('forbidden') ||
            msg.includes('permission') ||
            msg.includes('access has been denied')
        )
    }

    // Fallback to Gemini if Groq not used or failed
    if (!content && process.env.GEMINI_API_KEY) {
        for (const modelId of modelIds) {
            try {
                const model = genAI.getGenerativeModel({ model: modelId, generationConfig: { responseMimeType: "application/json" } })
                let result
                try {
                    result = await model.generateContent(prompt)
                } catch (rateLimitErr) {
                    const msg = rateLimitErr instanceof Error ? rateLimitErr.message : String(rateLimitErr)
                    if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit')) {
                        await sleep(3000)
                        result = await model.generateContent(prompt)
                    } else {
                        throw rateLimitErr
                    }
                }
                const response = result.response
                content = response.text()
                if (content) break
            } catch (e) {
                lastError = e instanceof Error ? e : new Error(String(e))
                const msg = lastError.message || ''
                if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit')) {
                    // Try the next model; if all providers are rate-limited, fallback parser handles this file.
                    continue
                }
                if (
                    msg.includes('404') ||
                    msg.includes('not found') ||
                    msg.includes('is not supported') ||
                    isGeminiAccessIssue(msg)
                ) {
                    continue
                }
                continue
            }
        }
    }

    let parsed: AiResume = extractFallbackParsed({
        resumeText: text,
        requiredSkills,
    })
    if (content) {
        try {
            parsed = JSON.parse(content) as AiResume
        } catch {
            // Keep fallback-parsed result when model returns malformed JSON.
        }
    }

    const deterministic = createDeterministicAnalysis({
        parsed,
        resumeText: text,
        jobTitle: jobData.title,
        requiredSkills: requiredSkills.length ? requiredSkills : decodedJobSkills.allSkills,
        minExperience: jobData.minExperience ?? 0,
    })
    const aiScore = typeof parsed.score === 'number' && Number.isFinite(parsed.score) ? clampScore(parsed.score) : null
    const finalScore = aiScore === null ? deterministic.score : clampScore(deterministic.score * 0.7 + aiScore * 0.3)
    const aiMatchAnalysis =
        parsed.match_analysis && typeof parsed.match_analysis === 'object'
            ? (parsed.match_analysis as Record<string, unknown>)
            : null
    const strengthsFromAi = Array.isArray(aiMatchAnalysis?.strengths)
        ? aiMatchAnalysis!.strengths!.filter((s): s is string => typeof s === 'string').slice(0, 2)
        : []
    const weaknessesFromAi = Array.isArray(aiMatchAnalysis?.weaknesses)
        ? aiMatchAnalysis!.weaknesses!.filter((s): s is string => typeof s === 'string').slice(0, 2)
        : []
    const candidateSkills = Array.isArray(parsed.skills) ? parsed.skills : []
    const missingRequiredSkills = findMissingRequiredSkills(requiredSkills, candidateSkills)
    const isQualified = missingRequiredSkills.length === 0
    const inferredYears = inferYearsOfExperience(parsed, text)
    const improvementPlan = buildCandidateImprovementPlan({
        job: {
            title: jobData.title,
            description: jobData.description,
            requirements: jobData.requirements,
            minExperience: jobData.minExperience,
            location: jobData.location,
            type: jobData.type,
        },
        requiredSkills,
        missingRequiredSkills,
        candidateSkills,
        candidateExperienceYears: inferredYears,
    })
    const improvementSuggestions = flattenImprovementPlan(improvementPlan)
    const mergedAnalysis = {
        strengths: [...deterministic.strengths, ...strengthsFromAi].slice(0, 5),
        weaknesses: [
            ...deterministic.weaknesses,
            ...(missingRequiredSkills.length ? [`Missing required skills: ${missingRequiredSkills.join(', ')}`] : []),
            ...weaknessesFromAi,
        ].slice(0, 6),
        reasoning:
            typeof aiMatchAnalysis?.reasoning === 'string' && aiMatchAnalysis.reasoning.trim().length > 0
                ? `${deterministic.reasoning} ${aiMatchAnalysis.reasoning}`
                : deterministic.reasoning,
        requiredSkills,
        missingRequiredSkills,
        isQualified,
        improvementSuggestions,
        improvementPlan,
    }
    const fallbackEmailToken = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const fallbackEmail = `unknown+${fallbackEmailToken}@example.com`

    // 4. Save to DB
    await getDb().insert(candidates).values({
        jobId,
        companyId: jobData.companyId,
        name: parsed.name || 'Unknown Candidate',
        email: parsed.email || fallbackEmail,
        phone: parsed.phone,
        resumeUrl: resumeUrl || '',
        parsedData: parsed as Record<string, unknown>,
        skills: parsed.skills,
        experience: parsed.summary,
        education: parsed.education,
        score: finalScore,
        matchAnalysis: mergedAnalysis,
        status: 'new'
    })

    return { success: true }
}

export async function uploadAndParseResume(jobId: string, formData: FormData) {
    const file = (formData.get('file') as File | null) ?? (formData.get('files') as File | null)
    if (!file) throw new Error('No file uploaded')
    const { processed, failed, errors } = await uploadAndParseResumes(jobId, formData)
    if (processed === 1) return { success: true }
    if (failed > 0) throw new Error(errors[0] || 'Resume upload failed')
    throw new Error('No file uploaded')
}

export async function uploadAndParseResumes(jobId: string, formData: FormData) {
    const userId = await requireCurrentUserId()
    const supabase = await createClient()
    const [jobRows, userCompanies] = await Promise.all([
        getDb().select().from(jobs).where(eq(jobs.id, jobId)).limit(1),
        getDb().select({ id: companies.id }).from(companies).where(eq(companies.ownerId, userId)).limit(1),
    ])
    if (!jobRows.length) throw new Error('Job not found')
    if (!userCompanies.length || jobRows[0].companyId !== userCompanies[0].id) throw new Error('Unauthorized')

    const files = formData
        .getAll('files')
        .filter((item): item is File => item instanceof File && item.size > 0)
    const fallbackFile = formData.get('file')
    if (!files.length && fallbackFile instanceof File && fallbackFile.size > 0) files.push(fallbackFile)
    if (!files.length) throw new Error('No files uploaded')

    const results: Array<{ fileName: string; success: boolean; error?: string }> = []
    const queue = [...files]
    const workerCount = Math.min(2, queue.length)
    await Promise.all(
        Array.from({ length: workerCount }).map(async () => {
            while (queue.length > 0) {
                const current = queue.shift()
                if (!current) continue
                try {
                    const result = await processSingleResume({
                        file: current,
                        jobId,
                        jobData: jobRows[0],
                        supabase,
                    })
                    if (result.success) {
                        results.push({ fileName: current.name, success: true })
                    } else {
                        results.push({ fileName: current.name, success: false, error: result.error })
                    }
                } catch (e) {
                    const message = e instanceof Error ? e.message : 'Unexpected upload error'
                    results.push({ fileName: current.name, success: false, error: message })
                }
            }
        })
    )

    revalidatePath(`/dashboard/jobs/${jobId}`)
    return {
        success: results.every((r) => r.success),
        processed: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        errors: results.filter((r) => !r.success).map((r) => `${r.fileName}: ${r.error ?? 'failed'}`),
        results,
    }
}


/** All screened candidates for the current user's company (for /dashboard/candidates) */
export async function getAllCandidatesForCompany() {
    unstable_noStore()
    try {
        const userId = await getCurrentUserIdOrNull()
        if (!userId) return []

        const userCompanies = await getDb().select({ id: companies.id }).from(companies).where(eq(companies.ownerId, userId)).limit(1)
        if (!userCompanies.length) return []

        const companyId = userCompanies[0].id
        const rows = await getDb().select().from(candidates).where(eq(candidates.companyId, companyId)).orderBy(desc(candidates.score))
        const jobIds = [...new Set(rows.map((r) => r.jobId))]
        const jobRows = jobIds.length
            ? await getDb()
                .select({ id: jobs.id, title: jobs.title })
                .from(jobs)
                .where(and(eq(jobs.companyId, companyId), inArray(jobs.id, jobIds)))
            : []
        const jobMap = Object.fromEntries(jobRows.map((j) => [j.id, j.title]))
        return rows.map((c) => ({ ...c, jobTitle: jobMap[c.jobId] ?? 'Unknown' }))
    } catch {
        return []
    }
}

export async function getCandidates(jobId: string) {
    unstable_noStore()
    try {
        const userId = await getCurrentUserIdOrNull()
        if (!userId) return []

        const [userCompanies, jobRows] = await Promise.all([
            getDb().select({ id: companies.id }).from(companies).where(eq(companies.ownerId, userId)).limit(1),
            getDb().select().from(jobs).where(eq(jobs.id, jobId)).limit(1),
        ])
        if (!userCompanies.length) return []

        if (!jobRows.length || jobRows[0].companyId !== userCompanies[0].id) return []

        const requiredSkills = decodeJobSkills(jobRows[0].skills).requiredSkills
        const rows = await getDb().select().from(candidates).where(eq(candidates.jobId, jobId))
        const jobRow = jobRows[0]
        const enriched = rows.map((candidate) => {
            const missingRequiredSkills = findMissingRequiredSkills(requiredSkills, candidate.skills)
            const existingAnalysis =
                candidate.matchAnalysis && typeof candidate.matchAnalysis === 'object'
                    ? (candidate.matchAnalysis as Record<string, unknown>)
                    : {}
            const isQualifiedRow = missingRequiredSkills.length === 0
            let inferredYears: number | null = null
            const pd = candidate.parsedData
            if (pd && typeof pd === 'object' && !Array.isArray(pd)) {
                const ey = (pd as Record<string, unknown>).experience_years
                if (typeof ey === 'number' && Number.isFinite(ey)) inferredYears = ey
            }
            const fallbackPlan = buildCandidateImprovementPlan({
                job: {
                    title: jobRow.title,
                    description: jobRow.description,
                    requirements: jobRow.requirements,
                    minExperience: jobRow.minExperience,
                    location: jobRow.location,
                    type: jobRow.type,
                },
                requiredSkills,
                missingRequiredSkills,
                candidateSkills: candidate.skills,
                candidateExperienceYears: inferredYears,
            })
            return {
                ...candidate,
                isQualified: isQualifiedRow,
                missingRequiredSkills,
                improvementSuggestions: !isQualifiedRow
                    ? flattenImprovementPlan(fallbackPlan)
                    : Array.isArray(existingAnalysis.improvementSuggestions)
                      ? existingAnalysis.improvementSuggestions
                      : [],
            }
        })
        return enriched.sort((a, b) => {
            if (a.isQualified !== b.isQualified) return a.isQualified ? -1 : 1
            const scoreA = typeof a.score === 'number' ? a.score : -1
            const scoreB = typeof b.score === 'number' ? b.score : -1
            return scoreB - scoreA
        })
    } catch {
        return []
    }
}

export async function updateCandidateStatus(candidateId: string, status: CandidateStatus) {
    const userId = await requireCurrentUserId()

    const userCompanies = await getDb().select({ id: companies.id }).from(companies).where(eq(companies.ownerId, userId)).limit(1)
    if (!userCompanies.length) throw new Error('Unauthorized')

    const candidateRows = await getDb()
        .select({
            id: candidates.id,
            jobId: candidates.jobId,
            companyId: candidates.companyId,
            status: candidates.status,
            name: candidates.name,
            email: candidates.email,
            phone: candidates.phone,
            score: candidates.score,
        })
        .from(candidates)
        .where(eq(candidates.id, candidateId))
        .limit(1)
    if (!candidateRows.length || candidateRows[0].companyId !== userCompanies[0].id) throw new Error('Unauthorized')

    const previousStatus = candidateRows[0].status as CandidateStatus
    if (previousStatus === 'hired' && status !== 'hired') {
        throw new Error('Status is locked after hired')
    }
    if (previousStatus === 'hired' && status === 'hired') {
        return
    }
    await getDb().update(candidates).set({ status }).where(eq(candidates.id, candidateId))

    const jobRows = await getDb()
        .select({ title: jobs.title })
        .from(jobs)
        .where(eq(jobs.id, candidateRows[0].jobId))
        .limit(1)

    await handleCandidateStatusChanged({
        companyId: candidateRows[0].companyId,
        candidateId: candidateRows[0].id,
        candidateName: candidateRows[0].name,
        candidateEmail: candidateRows[0].email,
        candidatePhone: candidateRows[0].phone,
        candidateScore: candidateRows[0].score,
        jobId: candidateRows[0].jobId,
        jobTitle: jobRows[0]?.title ?? 'Job',
        fromStatus: previousStatus,
        toStatus: status,
        changedByUserId: userId,
        changedAt: new Date(),
    })

    revalidatePath('/dashboard/jobs')
    revalidatePath('/dashboard')
}

export async function getCandidate(candidateId: string, jobId: string) {
    unstable_noStore()
    try {
        const userId = await getCurrentUserIdOrNull()
        if (!userId) return null

        const [userCompanies, jobRows] = await Promise.all([
            getDb().select({ id: companies.id }).from(companies).where(eq(companies.ownerId, userId)).limit(1),
            getDb().select().from(jobs).where(eq(jobs.id, jobId)).limit(1),
        ])
        if (!userCompanies.length) return null

        if (!jobRows.length || jobRows[0].companyId !== userCompanies[0].id) return null

        const candidateRows = await getDb().select().from(candidates).where(and(eq(candidates.id, candidateId), eq(candidates.jobId, jobId))).limit(1)
        if (!candidateRows.length) return null
        const candidate = candidateRows[0]
        const jobRow = jobRows[0]
        const requiredSkills = decodeJobSkills(jobRow.skills).requiredSkills
        const missingRequiredSkills = findMissingRequiredSkills(requiredSkills, candidate.skills)
        const isQualified = missingRequiredSkills.length === 0
        let inferredYears: number | null = null
        const pd = candidate.parsedData
        if (pd && typeof pd === 'object' && !Array.isArray(pd)) {
            const ey = (pd as Record<string, unknown>).experience_years
            if (typeof ey === 'number' && Number.isFinite(ey)) inferredYears = ey
        }
        const improvementPlan = buildCandidateImprovementPlan({
            job: {
                title: jobRow.title,
                description: jobRow.description,
                requirements: jobRow.requirements,
                minExperience: jobRow.minExperience,
                location: jobRow.location,
                type: jobRow.type,
            },
            requiredSkills,
            missingRequiredSkills,
            candidateSkills: candidate.skills,
            candidateExperienceYears: inferredYears,
        })
        return {
            ...candidate,
            requiredSkills,
            missingRequiredSkills,
            isQualified,
            improvementSuggestions: flattenImprovementPlan(improvementPlan),
            improvementPlan,
        }
    } catch {
        return null
    }
}
