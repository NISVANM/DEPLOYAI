import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type JsonRecord = Record<string, unknown>

/** Core fields already shown elsewhere on the candidate page or redundant */
const SKIP_IN_ADDITIONAL = new Set([
    'name',
    'email',
    'phone',
    'skills',
    'summary',
    'education',
    'score',
    'match_analysis',
])

function isNonEmptyArray(v: unknown): v is unknown[] {
    return Array.isArray(v) && v.length > 0
}

function firstNonEmptyArray(obj: JsonRecord, keys: string[]): unknown[] {
    for (const k of keys) {
        const v = obj[k]
        if (isNonEmptyArray(v)) return v
    }
    return []
}

function formatKeyLabel(key: string): string {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
}

function stringifyItem(item: unknown): string {
    if (item === null || item === undefined) return ''
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return String(item)
    try {
        return JSON.stringify(item, null, 2)
    } catch {
        return String(item)
    }
}

function WorkExperienceBlock({ items }: { items: unknown[] }) {
    return (
        <div className="space-y-4">
            {items.map((raw, i) => {
                if (raw === null || typeof raw !== 'object') {
                    return (
                        <p key={i} className="text-sm text-muted-foreground">
                            {String(raw)}
                        </p>
                    )
                }
                const row = raw as JsonRecord
                const title = (row.title ?? row.role ?? row.position ?? '') as string
                const company = (row.company ?? row.employer ?? row.organization ?? '') as string
                const location = (row.location ?? '') as string
                const start = (row.start ?? row.start_date ?? row.from ?? '') as string
                const end = (row.end ?? row.end_date ?? row.to ?? '') as string
                const period = [start, end].filter(Boolean).join(' — ')
                const desc = (row.description ?? row.summary ?? row.details ?? '') as string
                return (
                    <div key={i} className="border-b pb-4 last:border-0 last:pb-0">
                        <div className="font-medium">{title || company || 'Role'}</div>
                        {(company || title) && (
                            <div className="text-sm text-muted-foreground">
                                {[company, location].filter(Boolean).join(' · ')}
                            </div>
                        )}
                        {period && <div className="text-xs text-muted-foreground mt-0.5">{period}</div>}
                        {desc && <p className="text-sm mt-2 whitespace-pre-wrap text-muted-foreground">{desc}</p>}
                    </div>
                )
            })}
        </div>
    )
}

function ProjectBlock({ items }: { items: unknown[] }) {
    return (
        <div className="space-y-4">
            {items.map((raw, i) => {
                if (raw === null || typeof raw !== 'object') {
                    return (
                        <p key={i} className="text-sm">
                            {String(raw)}
                        </p>
                    )
                }
                const row = raw as JsonRecord
                const name = (row.name ?? row.title ?? 'Project') as string
                const desc = (row.description ?? row.summary ?? '') as string
                const tech = row.technologies ?? row.tech ?? row.stack
                const link = (row.link ?? row.url ?? row.repo ?? '') as string
                const techList = Array.isArray(tech) ? tech.join(', ') : typeof tech === 'string' ? tech : ''
                return (
                    <div key={i} className="border-b pb-4 last:border-0 last:pb-0">
                        <div className="font-medium">{name}</div>
                        {techList && <div className="text-xs text-muted-foreground mt-0.5">{techList}</div>}
                        {desc && <p className="text-sm mt-2 whitespace-pre-wrap text-muted-foreground">{desc}</p>}
                        {link && (
                            <a
                                href={link.startsWith('http') ? link : `https://${link}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline mt-1 inline-block"
                            >
                                Link
                            </a>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function CertificationBlock({ items }: { items: unknown[] }) {
    return (
        <div className="space-y-3">
            {items.map((raw, i) => {
                if (raw === null || typeof raw !== 'object') {
                    return (
                        <div key={i} className="text-sm">
                            {String(raw)}
                        </div>
                    )
                }
                const row = raw as JsonRecord
                const name = (row.name ?? row.title ?? row.certification ?? 'Certificate') as string
                const issuer = (row.issuer ?? row.organization ?? row.authority ?? '') as string
                const date = (row.date ?? row.year ?? row.issued ?? '') as string
                const id = (row.credential_id ?? row.id ?? '') as string
                return (
                    <div key={i} className="border-b pb-3 last:border-0 last:pb-0">
                        <div className="font-medium">{name}</div>
                        <div className="text-sm text-muted-foreground">
                            {[issuer, date].filter(Boolean).join(' · ')}
                        </div>
                        {id && <div className="text-xs text-muted-foreground mt-0.5">ID: {id}</div>}
                    </div>
                )
            })}
        </div>
    )
}

function LanguageBlock({ items }: { items: unknown[] }) {
    return (
        <ul className="list-disc list-inside space-y-1 text-sm">
            {items.map((raw, i) => {
                if (typeof raw === 'string') return <li key={i}>{raw}</li>
                if (raw && typeof raw === 'object') {
                    const row = raw as JsonRecord
                    const lang = (row.language ?? row.name ?? '') as string
                    const prof = (row.proficiency ?? row.level ?? '') as string
                    return (
                        <li key={i}>
                            {lang}
                            {prof ? ` (${prof})` : ''}
                        </li>
                    )
                }
                return <li key={i}>{String(raw)}</li>
            })}
        </ul>
    )
}

function SimpleTitleList({ items }: { items: unknown[] }) {
    return (
        <ul className="list-disc list-inside space-y-2 text-sm">
            {items.map((raw, i) => {
                if (typeof raw === 'string') return <li key={i}>{raw}</li>
                if (raw && typeof raw === 'object') {
                    const row = raw as JsonRecord
                    const title = (row.title ?? row.name ?? row.organization ?? '') as string
                    const rest = Object.entries(row)
                        .filter(([k]) => !['title', 'name', 'organization'].includes(k))
                        .map(([, v]) => (typeof v === 'object' ? JSON.stringify(v) : String(v)))
                        .filter(Boolean)
                        .join(' · ')
                    return (
                        <li key={i}>
                            {title}
                            {rest ? ` — ${rest}` : ''}
                        </li>
                    )
                }
                return <li key={i}>{String(raw)}</li>
            })}
        </ul>
    )
}

function AdditionalFields({ data, exclude }: { data: JsonRecord; exclude: Set<string> }) {
    const keys = Object.keys(data).filter((k) => !exclude.has(k) && !SKIP_IN_ADDITIONAL.has(k))
    if (!keys.length) return null

    return (
        <Card>
            <CardHeader>
                <CardTitle>Additional details from resume</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {keys.map((key) => {
                    const val = data[key]
                    return (
                        <div key={key}>
                            <h4 className="font-semibold text-sm mb-2">{formatKeyLabel(key)}</h4>
                            {val === null || val === undefined ? (
                                <p className="text-sm text-muted-foreground">—</p>
                            ) : typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' ? (
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{String(val)}</p>
                            ) : isNonEmptyArray(val) ? (
                                <SimpleTitleList items={val} />
                            ) : typeof val === 'object' && !Array.isArray(val) ? (
                                <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-x-auto max-h-64 overflow-y-auto">
                                    {JSON.stringify(val, null, 2)}
                                </pre>
                            ) : (
                                <p className="text-sm text-muted-foreground">{stringifyItem(val)}</p>
                            )}
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}

type Props = {
    parsedData: Record<string, unknown> | null | undefined
}

/**
 * Renders extended resume fields stored in `parsed_data` (projects, certifications, etc.)
 * and any leftover keys not covered by structured sections.
 */
export function CandidateResumeDetails({ parsedData }: Props) {
    if (!parsedData || typeof parsedData !== 'object') return null

    const data = parsedData as JsonRecord
    const rendered = new Set<string>(SKIP_IN_ADDITIONAL)

    const work = firstNonEmptyArray(data, ['work_experience', 'experience_history', 'employment'])
    if (work.length) {
        ;['work_experience', 'experience_history', 'employment'].forEach((k) => rendered.add(k))
    }

    const projects = firstNonEmptyArray(data, ['projects', 'personal_projects', 'key_projects'])
    if (projects.length) {
        ;['projects', 'personal_projects', 'key_projects'].forEach((k) => rendered.add(k))
    }

    const certs = firstNonEmptyArray(data, ['certifications', 'certificates', 'licenses'])
    if (certs.length) {
        ;['certifications', 'certificates', 'licenses'].forEach((k) => rendered.add(k))
    }

    const langs = firstNonEmptyArray(data, ['languages'])
    if (langs.length) rendered.add('languages')

    const awards = firstNonEmptyArray(data, ['awards', 'awards_honors'])
    if (awards.length) {
        ;['awards', 'awards_honors'].forEach((k) => rendered.add(k))
    }

    const pubs = firstNonEmptyArray(data, ['publications'])
    if (pubs.length) rendered.add('publications')

    const volunteer = firstNonEmptyArray(data, ['volunteer_experience', 'volunteer'])
    if (volunteer.length) {
        ;['volunteer_experience', 'volunteer'].forEach((k) => rendered.add(k))
    }

    const interests = firstNonEmptyArray(data, ['interests', 'hobbies'])
    if (interests.length) {
        ;['interests', 'hobbies'].forEach((k) => rendered.add(k))
    }

    const hasStructured =
        work.length > 0 ||
        projects.length > 0 ||
        certs.length > 0 ||
        langs.length > 0 ||
        awards.length > 0 ||
        pubs.length > 0 ||
        volunteer.length > 0 ||
        interests.length > 0

    const excludeAdditional = rendered
    const hasAdditional = Object.keys(data).some((k) => !excludeAdditional.has(k))

    if (!hasStructured && !hasAdditional) return null

    return (
        <div className="space-y-6">
            {work.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Work experience</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <WorkExperienceBlock items={work} />
                    </CardContent>
                </Card>
            )}

            {projects.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Projects</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ProjectBlock items={projects} />
                    </CardContent>
                </Card>
            )}

            {certs.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Certifications & licenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CertificationBlock items={certs} />
                    </CardContent>
                </Card>
            )}

            {langs.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Languages</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <LanguageBlock items={langs} />
                    </CardContent>
                </Card>
            )}

            {awards.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Awards & honors</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <SimpleTitleList items={awards} />
                    </CardContent>
                </Card>
            )}

            {pubs.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Publications</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <SimpleTitleList items={pubs} />
                    </CardContent>
                </Card>
            )}

            {volunteer.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Volunteer experience</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <WorkExperienceBlock items={volunteer} />
                    </CardContent>
                </Card>
            )}

            {interests.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Interests</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {typeof interests[0] === 'string' ? (
                            <div className="flex flex-wrap gap-2">
                                {(interests as string[]).map((s, i) => (
                                    <span key={i} className="text-sm rounded-md border px-2 py-0.5 bg-muted/40">
                                        {s}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <SimpleTitleList items={interests} />
                        )}
                    </CardContent>
                </Card>
            )}

            <AdditionalFields data={data} exclude={excludeAdditional} />
        </div>
    )
}
