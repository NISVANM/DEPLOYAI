/**
 * Job-aware improvement guidance for candidates who do not meet required skills.
 * Keeps suggestions deterministic (no extra AI calls) and tied to actual job fields.
 */

export type ImprovementJobContext = {
    title: string
    description?: string | null
    requirements?: string | null
    minExperience?: number | null
    location?: string | null
    type?: string | null
}

export type CandidateImprovementPlan = {
    /** Short headline for the section */
    headline: string
    /** One paragraph explaining why they are not qualified */
    gapSummary: string
    /** Concrete actions per missing required skill */
    perSkill: Array<{ skill: string; bullets: string[] }>
    /** Align resume narrative with this specific posting */
    roleAlignment: string[]
    /** Present only when job asks for more experience than we infer */
    experienceGap?: string[]
    /** Short closing checklist */
    nextStepsChecklist: string[]
}

const MAX_SNIPPET = 380

function truncateSnippet(text: string | null | undefined): string {
    if (!text?.trim()) return ''
    const t = text.replace(/\s+/g, ' ').trim()
    if (t.length <= MAX_SNIPPET) return t
    return `${t.slice(0, MAX_SNIPPET).trim()}…`
}

/** Pull a few meaningful tokens from job text to reference in copy (not for matching). */
function extractJobThemes(description: string, requirements: string): string[] {
    const combined = `${description} ${requirements}`.toLowerCase()
    const stop = new Set([
        'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'you', 'will', 'are', 'our', 'team',
        'role', 'work', 'experience', 'skills', 'ability', 'strong', 'good', 'must', 'have', 'years',
    ])
    const words = combined.match(/[a-z][a-z0-9+.#-]{3,}/g) ?? []
    const freq = new Map<string, number>()
    for (const w of words) {
        if (stop.has(w)) continue
        freq.set(w, (freq.get(w) ?? 0) + 1)
    }
    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([w]) => w)
}

function skillCategoryHint(skill: string): string {
    const s = skill.toLowerCase()
    if (/sql|database|postgres|mysql|mongodb|dynamo|oracle/i.test(skill))
        return 'Include schema design, querying, or persistence work you owned end-to-end.'
    if (/aws|azure|gcp|cloud|kubernetes|docker/i.test(skill))
        return 'Name the services or deployment pattern (e.g. CI/CD, containers, infra-as-code) you used.'
    if (/react|vue|angular|next\.?js|svelte|frontend|ui|typescript|javascript/i.test(skill))
        return 'Cite a shipped UI feature: scope, stack, and measurable outcome (latency, adoption, defect reduction).'
    if (/python|java|go|rust|c\+\+|node|backend|api|microservice/i.test(skill))
        return 'Describe APIs, services, or systems you built or maintained, including scale or reliability notes if possible.'
    if (/ml|machine learning|deep learning|tensorflow|pytorch|model/i.test(skill))
        return 'State problem statement, data source, model type, and offline or production evaluation.'
    if (/lead|manager|mentor|stakeholder/i.test(skill))
        return 'Add scope of ownership: team size, milestones, and cross-functional partners.'
    return 'Tie this skill to outcomes: what you built, how you used it, and the business or user impact.'
}

function bulletsForMissingSkill(skill: string): string[] {
    const hint = skillCategoryHint(skill)
    return [
        `Add a bullet under **Experience** or **Projects** that starts with an action verb and names "${skill}" explicitly (avoid vague phrasing like "familiar with").`,
        hint,
        `If you used "${skill}" informally, rename or expand that bullet so the keyword appears in the same form recruiters search for (mirror the job posting wording where honest).`,
        `Optional: add a one-line **Skills** sub-line grouping "${skill}" next to the role where you actually applied it.`,
    ].map((line) => line.replace(/\*\*/g, ''))
}

export function buildCandidateImprovementPlan(params: {
    job: ImprovementJobContext
    requiredSkills: string[]
    missingRequiredSkills: string[]
    candidateSkills: string[] | null | undefined
    candidateExperienceYears?: number | null
}): CandidateImprovementPlan {
    const {
        job,
        requiredSkills,
        missingRequiredSkills,
        candidateSkills,
        candidateExperienceYears,
    } = params

    const descSnippet = truncateSnippet(job.description)
    const reqSnippet = truncateSnippet(job.requirements)
    const themes = extractJobThemes(descSnippet, reqSnippet)
    const themesPhrase = themes.length ? themes.slice(0, 3).join(', ') : ''

    const present = Array.isArray(candidateSkills) ? candidateSkills.filter(Boolean) : []
    const presentSample = present.slice(0, 6).join(', ')

    const minExp = Math.max(0, job.minExperience ?? 0)
    const inferredYears =
        typeof candidateExperienceYears === 'number' && Number.isFinite(candidateExperienceYears)
            ? Math.max(0, candidateExperienceYears)
            : null

    if (missingRequiredSkills.length === 0) {
        return {
            headline: `Strengthen your profile for "${job.title}"`,
            gapSummary:
                'Required skills for this posting are satisfied. Focus on sharper impact statements and role-specific proof points.',
            perSkill: [],
            roleAlignment: [
                `Echo language from the job description where truthful (${themesPhrase || 'responsibilities and outcomes from the posting'}).`,
                `Lead your summary with the closest match to "${job.title}" using 2–3 proof-backed accomplishments.`,
            ],
            experienceGap:
                minExp > 0 && inferredYears !== null && inferredYears < minExp
                    ? [
                          `The role lists ${minExp}+ years; your resume suggests ~${inferredYears}. Add tenure dates and leadership scope, or highlight accelerated ownership if totals are lower.`,
                      ]
                    : undefined,
            nextStepsChecklist: [
                'Quantify 3 bullets (%, latency, revenue, users, error rate).',
                'Add links to portfolio, GitHub, or case studies where relevant.',
                'Proofread so skill names match the posting exactly.',
            ],
        }
    }

    const headline = `How to move toward qualifying for "${job.title}"`
    const gapSummaryParts = [
        `This posting requires every must-have skill listed by the employer. Right now the resume does not show evidence for: ${missingRequiredSkills.join(', ')}.`,
    ]
    if (presentSample) {
        gapSummaryParts.push(`Skills already visible on the resume include: ${presentSample}${present.length > 6 ? '…' : ''}. Bridge each gap by connecting existing work to the missing keywords.`)
    } else {
        gapSummaryParts.push('Consider expanding the skills and experience sections so reviewers can verify technical depth.')
    }
    if (reqSnippet) {
        gapSummaryParts.push(`From the job requirements: "${reqSnippet}"`)
    } else if (descSnippet) {
        gapSummaryParts.push(`Role focus (from description): "${descSnippet}"`)
    }

    const roleAlignment: string[] = [
        `Rewrite the professional summary (2–3 lines) to foreground overlap with "${job.title}"${job.type ? ` (${job.type})` : ''}${job.location ? ` — note fit for ${job.location}` : ''}.`,
    ]
    if (themesPhrase) {
        roleAlignment.push(`Weave these recurring themes from the posting into honest bullets: ${themesPhrase}.`)
    }

    const experienceGap: string[] = []
    if (minExp > 0 && inferredYears !== null && inferredYears < minExp) {
        experienceGap.push(
            `Minimum experience requested is ${minExp} year(s); inferred resume tenure is about ${inferredYears}. Add explicit date ranges per role, internships, or freelance work, or clarify overlapping responsibilities that justify seniority.`
        )
    }

    const nextStepsChecklist = [
        `Address each missing skill (${missingRequiredSkills.join(', ')}) with at least one concrete bullet.`,
        'Place the strongest proof in the top half of the first page.',
        'Ensure spelled technologies match the job post (including casing) where accurate.',
        'Re-upload or export PDF text cleanly so automated screening can read keywords.',
    ]

    return {
        headline,
        gapSummary: gapSummaryParts.join(' '),
        perSkill: missingRequiredSkills.map((skill) => ({
            skill,
            bullets: bulletsForMissingSkill(skill),
        })),
        roleAlignment,
        experienceGap: experienceGap.length ? experienceGap : undefined,
        nextStepsChecklist,
    }
}

/** Flat list for JSON storage / legacy consumers */
export function flattenImprovementPlan(plan: CandidateImprovementPlan): string[] {
    const out: string[] = [plan.gapSummary]
    for (const block of plan.perSkill) {
        out.push(`Skill: ${block.skill}`)
        out.push(...block.bullets)
    }
    out.push(...plan.roleAlignment)
    if (plan.experienceGap?.length) out.push(...plan.experienceGap)
    out.push(...plan.nextStepsChecklist.map((c) => `Checklist: ${c}`))
    return out
}
