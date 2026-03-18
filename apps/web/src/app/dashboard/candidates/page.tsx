import Link from 'next/link'
import { getAllCandidatesForCompany } from '@/lib/actions/candidates'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export default async function CandidatesPage() {
    const candidates = await getAllCandidatesForCompany()

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Candidates</h1>
                <p className="text-muted-foreground">
                    All screened candidates across your jobs. Sort and filter by score or status.
                </p>
            </div>

            {candidates.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
                        <div className="rounded-full bg-muted p-4">
                            <Users className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <div className="text-center space-y-2">
                            <h2 className="text-xl font-semibold">No candidates yet</h2>
                            <p className="text-muted-foreground max-w-sm">
                                Upload resumes from a job page to screen and rank candidates here.
                            </p>
                        </div>
                        <Button asChild>
                            <Link href="/dashboard/jobs">Go to Jobs</Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Candidate</TableHead>
                                    <TableHead>Job</TableHead>
                                    <TableHead>Match</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Applied</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {candidates.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell>
                                            <Link
                                                href={`/dashboard/jobs/${c.jobId}/candidates/${c.id}`}
                                                className="font-medium hover:underline"
                                            >
                                                {c.name}
                                            </Link>
                                            <span className="block text-xs text-muted-foreground">{c.email}</span>
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                href={`/dashboard/jobs/${c.jobId}`}
                                                className="text-sm hover:underline"
                                            >
                                                {'jobTitle' in c ? String(c.jobTitle) : '—'}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Progress
                                                    value={c.score ?? 0}
                                                    className={cn(
                                                        'w-16',
                                                        (c.score ?? 0) >= 80 && '[&>div]:bg-green-500',
                                                        (c.score ?? 0) >= 50 && (c.score ?? 0) < 80 && '[&>div]:bg-yellow-500',
                                                        (c.score ?? 0) < 50 && '[&>div]:bg-red-500'
                                                    )}
                                                />
                                                <span className="font-medium">{c.score ?? 0}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    c.status === 'new'
                                                        ? 'secondary'
                                                        : c.status === 'interviewed'
                                                          ? 'default'
                                                          : 'outline'
                                                }
                                            >
                                                {c.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/dashboard/jobs/${c.jobId}/candidates/${c.id}`}>
                                                    View profile
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
