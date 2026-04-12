import { getCandidate } from "@/lib/actions/candidates"
import { getJob } from "@/lib/actions/jobs"
import { isCalcomSchedulingActiveForCompany } from "@/lib/actions/scheduling"
import { CandidateSchedulingLinkCard } from "@/components/candidate-scheduling-link"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { CandidateStatusActions } from "@/components/candidate-status-actions"
import { ArrowLeft, Download, Mail, Phone, ExternalLink } from "lucide-react"
import Link from "next/link"

export default async function CandidatePage({ params }: { params: Promise<{ id: string; candidateId: string }> }) {
    const { id, candidateId } = await params
    const job = await getJob(id)
    if (!job) notFound()

    const candidate = await getCandidate(candidateId, id)
    if (!candidate) notFound()

    const schedulingActive = await isCalcomSchedulingActiveForCompany(job.companyId)

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
                        </CardContent>
                    </Card>

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
                                    {(candidate.education as any[])?.map((edu: any, i: number) => (
                                        <div key={i} className="flex justify-between items-start border-b pb-2 last:border-0">
                                            <div>
                                                <div className="font-medium">{edu.school}</div>
                                                <div className="text-sm text-muted-foreground">{edu.degree}</div>
                                            </div>
                                            <div className="text-sm text-muted-foreground">{edu.year}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
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
