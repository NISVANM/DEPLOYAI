'use server'

import { createClient } from '@/lib/supabase-server'
import { candidates, jobs, companies } from '@/lib/db/schema'
import { revalidatePath, unstable_noStore } from 'next/cache'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db/drizzle-client'
import { GoogleGenerativeAI } from '@google/generative-ai'
import mammoth from 'mammoth'

// PDF parsing is done in GET /api/extract-pdf-text to avoid bundling pdf-parse into
// server actions (worker / "expression too dynamic" errors in Next.js).
function getBaseUrl(): string {
    if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
    return 'http://localhost:3000'
}

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function uploadAndParseResume(jobId: string, formData: FormData) {
    const file = formData.get('file') as File
    if (!file) {
        throw new Error('No file uploaded')
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // 1. Upload to Supabase Storage
    const filename = `${jobId}/${Date.now()}-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(filename, file)

    if (uploadError) {
        console.error('Upload Error:', uploadError)
    }

    const resumeUrl = uploadData?.path
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/resumes/${uploadData.path}`
        : null

    // 2. Extract Text (PDF via API route to avoid bundling pdf-parse in this action)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    let text = ''

    if (file.type === 'application/pdf') {
        const form = new FormData()
        form.set('file', new Blob([buffer], { type: 'application/pdf' }), 'resume.pdf')
        const res = await fetch(`${getBaseUrl()}/api/extract-pdf-text`, { method: 'POST', body: form })
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error ?? `PDF extraction failed: ${res.status}`)
        }
        const data = (await res.json()) as { text?: string }
        text = data.text ?? ''
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
    } else {
        text = buffer.toString('utf-8')
    }

    // 3. AI Parse & Score (Groq free tier first if key set; else Gemini)
    const jobRows = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1)
    if (!jobRows.length) throw new Error('Job not found')
    const jobData = jobRows[0]

    const userCompanies = await db.select({ id: companies.id }).from(companies).where(eq(companies.ownerId, user.id)).limit(1)
    if (!userCompanies.length || jobData.companyId !== userCompanies[0].id) throw new Error('Unauthorized')

    if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
        throw new Error('Set GROQ_API_KEY (free tier recommended) or GEMINI_API_KEY in .env.local. Get Groq key at console.groq.com')
    }

    // Model must be available in your Google AI Studio / API key. Fallback to gemini-pro if primary returns 404.
    const modelIds = process.env.GEMINI_MODEL
        ? [process.env.GEMINI_MODEL, 'gemini-pro']
        : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-pro']
    const prompt = `
    You are an expert recruiter. Extract candidate information from the resume text below and structure it into JSON.
    Also score the candidate from 0-100 based on the Job Requirements.
    
    Job Context:
    - Title: ${jobData.title}
    - Description: ${jobData.description}
    - Required Skills: ${jobData.skills?.join(', ')}
    - Min Experience: ${jobData.minExperience} years

    Resume Text:
    ${text.substring(0, 10000)}
    
    Return strict JSON with this structure:
    {
        "name": "string",
        "email": "string",
        "phone": "string",
        "skills": ["skill1", "skill2"],
        "experience_years": number,
        "education": [{"degree": "string", "school": "string", "year": "string"}],
        "summary": "string",
        "score": number, // 0-100
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
                    throw new Error('Gemini API rate limit exceeded. Try adding GROQ_API_KEY (free) in .env.local. Get key at console.groq.com')
                }
                if (msg.includes('404') || msg.includes('not found') || msg.includes('is not supported')) continue
                throw lastError
            }
        }
    }

    if (!content) throw lastError ?? new Error('AI parse failed. Set GROQ_API_KEY (free at console.groq.com) or GEMINI_API_KEY in .env.local')

    const parsed = JSON.parse(content)

    // 4. Save to DB
    await db.insert(candidates).values({
        jobId,
        companyId: jobData.companyId,
        name: parsed.name || 'Unknown Candidate',
        email: parsed.email || 'unknown@example.com',
        phone: parsed.phone,
        resumeUrl: resumeUrl || '',
        parsedData: parsed,
        skills: parsed.skills,
        experience: parsed.summary,
        education: parsed.education,
        score: parsed.score,
        matchAnalysis: parsed.match_analysis,
        status: 'new'
    })

    revalidatePath(`/dashboard/jobs/${jobId}`)
    return { success: true }
}

/** All screened candidates for the current user's company (for /dashboard/candidates) */
export async function getAllCandidatesForCompany() {
    unstable_noStore()
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []

        const userCompanies = await db.select({ id: companies.id }).from(companies).where(eq(companies.ownerId, user.id)).limit(1)
        if (!userCompanies.length) return []

        const companyId = userCompanies[0].id
        const rows = await db.select().from(candidates).where(eq(candidates.companyId, companyId)).orderBy(desc(candidates.score))
        const jobIds = [...new Set(rows.map((r) => r.jobId))]
        const jobRows = jobIds.length ? await db.select({ id: jobs.id, title: jobs.title }).from(jobs).where(eq(jobs.companyId, companyId)) : []
        const jobMap = Object.fromEntries(jobRows.map((j) => [j.id, j.title]))
        return rows.map((c) => ({ ...c, jobTitle: jobMap[c.jobId] ?? 'Unknown' }))
    } catch {
        return []
    }
}

export async function getCandidates(jobId: string) {
    unstable_noStore()
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []

        const userCompanies = await db.select({ id: companies.id }).from(companies).where(eq(companies.ownerId, user.id)).limit(1)
        if (!userCompanies.length) return []

        const jobRows = await db.select({ companyId: jobs.companyId }).from(jobs).where(eq(jobs.id, jobId)).limit(1)
        if (!jobRows.length || jobRows[0].companyId !== userCompanies[0].id) return []

        return await db.select().from(candidates).where(eq(candidates.jobId, jobId)).orderBy(candidates.score)
    } catch {
        return []
    }
}

export async function updateCandidateStatus(candidateId: string, status: 'new' | 'screening' | 'interviewed' | 'offered' | 'rejected') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const userCompanies = await db.select({ id: companies.id }).from(companies).where(eq(companies.ownerId, user.id)).limit(1)
    if (!userCompanies.length) throw new Error('Unauthorized')

    const candidateRows = await db.select({ jobId: candidates.jobId, companyId: candidates.companyId }).from(candidates).where(eq(candidates.id, candidateId)).limit(1)
    if (!candidateRows.length || candidateRows[0].companyId !== userCompanies[0].id) throw new Error('Unauthorized')

    await db.update(candidates).set({ status }).where(eq(candidates.id, candidateId))
    revalidatePath('/dashboard/jobs')
    revalidatePath('/dashboard')
}

export async function getCandidate(candidateId: string, jobId: string) {
    unstable_noStore()
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return null

        const userCompanies = await db.select({ id: companies.id }).from(companies).where(eq(companies.ownerId, user.id)).limit(1)
        if (!userCompanies.length) return null

        const jobRows = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1)
        if (!jobRows.length || jobRows[0].companyId !== userCompanies[0].id) return null

        const candidateRows = await db.select().from(candidates).where(and(eq(candidates.id, candidateId), eq(candidates.jobId, jobId))).limit(1)
        if (!candidateRows.length) return null
        return candidateRows[0]
    } catch {
        return null
    }
}
