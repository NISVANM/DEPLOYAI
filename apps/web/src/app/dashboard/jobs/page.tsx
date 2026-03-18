import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getJobs } from "@/lib/actions/jobs"
import { DeleteJobButton } from "@/components/delete-job-button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function JobsPage() {
    const jobs = await getJobs()

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
                    <p className="text-muted-foreground">Manage your job postings and view candidates.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/jobs/new">Post New Job</Link>
                </Button>
            </div>

            {jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                        {/* Icon */}
                    </div>
                    <h2 className="text-xl font-semibold">No jobs posted</h2>
                    <p className="text-muted-foreground">Get started by creating your first job posting.</p>
                    <Button asChild>
                        <Link href="/dashboard/jobs/new">Post Job</Link>
                    </Button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {jobs.map((job) => (
                        <Card key={job.id}>
                            <CardHeader>
                                <div className="flex justify-between items-start gap-2">
                                    <CardTitle className="line-clamp-1">{job.title}</CardTitle>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Badge variant={job.status === 'active' ? 'default' : 'secondary'}>{job.status}</Badge>
                                        <DeleteJobButton jobId={job.id} jobTitle={job.title} iconOnly />
                                    </div>
                                </div>
                                <CardDescription>{job.location} • {job.type}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="line-clamp-3 text-sm text-muted-foreground">{job.description}</p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {job.skills?.slice(0, 3).map((skill: string) => (
                                        <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                                    ))}
                                    {job.skills && job.skills.length > 3 && (
                                        <Badge variant="outline" className="text-xs">+{job.skills.length - 3}</Badge>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button variant="outline" className="w-full" asChild>
                                    <Link href={`/dashboard/jobs/${job.id}`}>View Candidates</Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
