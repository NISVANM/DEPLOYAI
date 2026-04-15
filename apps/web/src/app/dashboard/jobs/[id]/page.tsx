import { UploadZone } from "@/components/upload-zone"
import { CandidatesTable } from "@/components/candidates-table"
import { DeleteJobButton } from "@/components/delete-job-button"
import { getCandidates } from "@/lib/actions/candidates"
import { getJob } from "@/lib/actions/jobs"
import { notFound } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function JobDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const [jobData, candidates] = await Promise.all([
        getJob(id),
        getCandidates(id),
    ])
    if (!jobData) notFound()

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-3xl font-bold tracking-tight">{jobData.title}</h1>
                        <Badge variant={jobData.status === 'active' ? 'default' : 'secondary'}>{jobData.status}</Badge>
                    </div>
                    <p className="text-muted-foreground">{jobData.location} • {jobData.type}</p>
                </div>
                <DeleteJobButton jobId={jobData.id} jobTitle={jobData.title} />
            </div>

            <div className="grid gap-6 md:grid-cols-[1fr_300px]">
                <div className="space-y-6">
                    <Tabs defaultValue="candidates">
                        <TabsList>
                            <TabsTrigger value="candidates">Candidates ({candidates.length})</TabsTrigger>
                            <TabsTrigger value="upload">Upload Resumes</TabsTrigger>
                            <TabsTrigger value="details">Job Details</TabsTrigger>
                        </TabsList>
                        <TabsContent value="candidates" className="space-y-4">
                            <CandidatesTable jobId={jobData.id} candidates={candidates} />
                        </TabsContent>
                        <TabsContent value="upload">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Upload Resumes</CardTitle>
                                    <CardDescription>
                                        Upload PDF or DOCX resumes. The AI will automatically parse and rank them.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <UploadZone jobId={jobData.id} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="details">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Description</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{jobData.description}</p>

                                    <h3 className="font-semibold">Requirements</h3>
                                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{jobData.requirements}</p>

                                    <h3 className="font-semibold">Skills</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {jobData.skills?.map(skill => (
                                            <Badge key={skill} variant="secondary">{skill}</Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Total Candidates</span>
                                <span className="font-medium">{candidates.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Average Score</span>
                                <span className="font-medium">
                                    {candidates.length > 0
                                        ? Math.round(candidates.reduce((acc, c) => acc + (c.score || 0), 0) / candidates.length)
                                        : 0
                                    }%
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
