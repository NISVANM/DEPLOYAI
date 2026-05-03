import { getCandidate } from "@/lib/actions/candidates"
import { getJob } from "@/lib/actions/jobs"
import { isCalcomSchedulingActiveForCompany } from "@/lib/actions/scheduling"
import { CandidateSchedulingLinkCard } from "@/components/candidate-scheduling-link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { CandidateStatusActions } from "@/components/candidate-status-actions"
import { CandidateResumeDetails } from "@/components/candidate-resume-details"
import { ArrowLeft, Download, Mail, Phone, ExternalLink } from "lucide-react"
import Link from "next/link"
import { decodeJobSkills } from "@/lib/job-skills"
import type { CandidateImprovementPlan } from "@/lib/candidate-improvement-suggestions"

export default async function CandidatePage({ params }: { params: Promise<{ id: string; candidateId: string }> }) {
    const { id, candidateId } = await params
    const [job, candidate] = await Promise.all([
        getJob(id),
        getCandidate(candidateId, id),
    ])
    if (!job) notFound()

    if (!candidate) notFound()

    const schedulingActive = await isCalcomSchedulingActiveForCompany(job.companyId)
    const decodedSkills = decodeJobSkills(job.skills)
    const requiredSkills = ((candidate as { requiredSkills?: string[] }).requiredSkills ?? decodedSkills.requiredSkills)
    const missingRequiredSkills = ((candidate as { missingRequiredSkills?: string[] }).missingRequiredSkills ?? [])
    const isQualified = ((candidate as { isQualified?: boolean }).isQualified ?? missingRequiredSkills.length === 0)
    const improvementPlan =
        ((candidate as { improvementPlan?: CandidateImprovementPlan }).improvementPlan ??
            (typeof candidate.matchAnalysis === 'object' &&
            candidate.matchAnalysis !== null &&
            'improvementPlan' in candidate.matchAnalysis
                ? (candidate.matchAnalysis as { improvementPlan?: CandidateImprovementPlan }).improvementPlan
                : undefined))

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={`/dashboard/jobs/${id}`}><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{candidate.name}</h1>
                    <p className="text-muted-foreground">{job.title} • {candidate.status}</p>
                </div>
                <CandidateStatusActions candidateId={candidateId} jobId={id} currentStatus={candidate.status} />
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>AI Match Analysis</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="text-4xl font-bold">{candidate.score}%</div>
                                <Progress
                                    value={candidate.score ?? 0}
                                    className={cn(
                                        "flex-1 h-4",
                                        (candidate.score ?? 0) >= 80 && "[&>div]:bg-green-500",
                                        (candidate.score ?? 0) >= 50 && (candidate.score ?? 0) < 80 && "[&>div]:bg-yellow-500",
                                        (candidate.score ?? 0) < 50 && "[&>div]:bg-red-500"
                                    )}
                                />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <h4 className="font-semibold mb-2 text-green-600">Strengths</h4>
                                    <ul className="list-disc list-inside text-sm space-y-1">
                                        {(candidate.matchAnalysis as any)?.strengths?.map((s: string, i: number) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2 text-red-600">Weaknesses</h4>
                                    <ul className="list-disc list-inside text-sm space-y-1">
                                        {(candidate.matchAnalysis as any)?.weaknesses?.map((s: string, i: number) => (
                                            <li key={i}>{s}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-2">Reasoning</h4>
                                <p className="text-sm text-muted-foreground">{(candidate.matchAnalysis as any)?.reasoning}</p>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-semibold">Qualification Status</h4>
                                <Badge variant={isQualified ? "default" : "destructive"}>
                                    {isQualified ? "Qualified" : "Not Qualified"}
                                </Badge>
                                {requiredSkills.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {requiredSkills.map((skill) => (
                                            <Badge
                                                key={skill}
                                                variant={missingRequiredSkills.includes(skill) ? "destructive" : "secondary"}
                                            >
                                                {skill}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {!isQualified && improvementPlan && (
                        <Card className="border-destructive/25 bg-muted/30">
                            <CardHeader>
                                <CardTitle className="text-lg">{improvementPlan.headline}</CardTitle>
                                <CardDescription>
                                    Practical updates aligned with this posting — based on required skills, job text, and what already appears on the resume.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-8">
                                <section className="space-y-2">
                                    <h4 className="text-sm font-semibold tracking-tight">Why this profile is not qualified yet</h4>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{improvementPlan.gapSummary}</p>
                                </section>

                                {improvementPlan.perSkill.length > 0 && (
                                    <section className="space-y-4">
                                        <h4 className="text-sm font-semibold tracking-tight">Close each missing must-have skill</h4>
                                        <div className="space-y-4">
                                            {improvementPlan.perSkill.map(({ skill, bullets }) => (
                                                <div
                                                    key={skill}
                                                    className="rounded-lg border bg-background p-4 shadow-xs"
                                                >
                                                    <div className="mb-2 flex items-center gap-2">
                                                        <Badge variant="destructive" className="text-xs">
                                                            Missing
                                                        </Badge>
                                                        <span className="font-medium text-sm">{skill}</span>
                                                    </div>
                                                    <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                                                        {bullets.map((line, i) => (
                                                            <li key={`${skill}-${i}`} className="leading-relaxed">
                                                                {line}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                <section className="space-y-2">
                                    <h4 className="text-sm font-semibold tracking-tight">Align the narrative with this role</h4>
                                    <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                                        {improvementPlan.roleAlignment.map((line, i) => (
                                            <li key={`align-${i}`} className="leading-relaxed">
                                                {line}
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                {improvementPlan.experienceGap && improvementPlan.experienceGap.length > 0 && (
                                    <section className="space-y-2">
                                        <h4 className="text-sm font-semibold tracking-tight">Experience depth vs. job minimum</h4>
                                        <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                                            {improvementPlan.experienceGap.map((line, i) => (
                                                <li key={`exp-${i}`} className="leading-relaxed">
                                                    {line}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )}

                                <section className="space-y-2">
                                    <h4 className="text-sm font-semibold tracking-tight">Before you re-submit</h4>
                                    <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
                                        {improvementPlan.nextStepsChecklist.map((line, i) => (
                                            <li key={`chk-${i}`} className="leading-relaxed">
                                                {line}
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Experience & Education</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <h3 className="font-semibold mb-2">Summary</h3>
                                <p className="text-sm text-muted-foreground">{candidate.experience as string}</p>
                            </div>

                            <div>
                                <h3 className="font-semibold mb-2">Education</h3>
                                <div className="space-y-2">
                                    {(candidate.education as any[])?.map((edu: any, i: number) => {
                                        const school = edu.school ?? edu.institution ?? edu.university ?? ''
                                        const degree = edu.degree ?? edu.program ?? edu.qualification ?? ''
                                        const year = edu.year ?? edu.graduation_year ?? edu.end ?? ''
                                        const extra = [edu.field, edu.gpa, edu.honors].filter(Boolean).join(' · ')
                                        return (
                                            <div key={i} className="flex justify-between items-start border-b pb-2 last:border-0">
                                                <div>
                                                    <div className="font-medium">{school || 'Education'}</div>
                                                    {degree && <div className="text-sm text-muted-foreground">{degree}</div>}
                                                    {extra && <div className="text-xs text-muted-foreground mt-0.5">{extra}</div>}
                                                </div>
                                                {year ? <div className="text-sm text-muted-foreground shrink-0">{year}</div> : null}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <CandidateResumeDetails
                        parsedData={
                            candidate.parsedData && typeof candidate.parsedData === 'object' && !Array.isArray(candidate.parsedData)
                                ? (candidate.parsedData as Record<string, unknown>)
                                : null
                        }
                    />
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Contact Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <a href={`mailto:${candidate.email}`} className="text-sm hover:underline">{candidate.email}</a>
                            </div>
                            <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{candidate.phone || 'N/A'}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Skills</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {candidate.skills?.map(skill => (
                                    <Badge key={skill} variant="secondary">{skill}</Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {candidate.resumeUrl && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Resume</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Button className="w-full" asChild>
                                    <a href={candidate.resumeUrl} target="_blank" rel="noopener noreferrer">
                                        <Download className="mr-2 h-4 w-4" /> Download Resume
                                    </a>
                                </Button>
                                <div className="mt-4 text-center">
                                    <a href={candidate.resumeUrl} target="_blank" className="text-xs text-muted-foreground flex items-center justify-center gap-1 hover:underline">
                                        Open in new tab <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {schedulingActive && (
                        <CandidateSchedulingLinkCard candidateId={candidateId} jobId={id} />
                    )}
                </div>
            </div>
        </div>
    )
}
