'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, FileText } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { updateCandidateStatus } from '@/lib/actions/candidates'
import { toast } from 'sonner'

interface Candidate {
    id: string
    name: string
    email: string
    score: number | null
    status: string
    createdAt: Date
    skills: string[] | null
    resumeUrl?: string | null
}

export function CandidatesTable({ jobId, candidates }: { jobId: string; candidates: Candidate[] }) {
    const router = useRouter()

    async function handleStatusChange(candidateId: string, status: 'interviewed' | 'rejected') {
        try {
            await updateCandidateStatus(candidateId, status)
            toast.success(status === 'interviewed' ? 'Moved to interview' : 'Candidate rejected')
            router.refresh()
        } catch {
            toast.error('Failed to update status')
        }
    }
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Match Score</TableHead>
                        <TableHead>Skills Match</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Applied</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {candidates.map((candidate, index) => (
                        <TableRow key={candidate.id}>
                            <TableCell className="font-medium">#{index + 1}</TableCell>
                            <TableCell>
                                <Link href={`/dashboard/jobs/${jobId}/candidates/${candidate.id}`} className="flex flex-col hover:underline">
                                    <span className="font-medium">{candidate.name}</span>
                                    <span className="text-xs text-muted-foreground">{candidate.email}</span>
                                </Link>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Progress
                                        value={candidate.score ?? 0}
                                        className={cn(
                                            "w-[60px]",
                                            (candidate.score ?? 0) >= 80 && "[&>div]:bg-green-500",
                                            (candidate.score ?? 0) >= 50 && (candidate.score ?? 0) < 80 && "[&>div]:bg-yellow-500",
                                            (candidate.score ?? 0) < 50 && "[&>div]:bg-red-500"
                                        )}
                                    />
                                    <span className="font-bold">{candidate.score ?? 0}%</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {candidate.skills?.slice(0, 2).map((skill: string) => (
                                        <Badge key={skill} variant="secondary" className="text-[10px]">{skill}</Badge>
                                    ))}
                                    {(candidate.skills?.length ?? 0) > 2 && (
                                        <Badge variant="outline" className="text-[10px]">+{(candidate.skills?.length ?? 0) - 2}</Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={
                                    candidate.status === 'new' ? 'secondary' :
                                        candidate.status === 'interviewed' ? 'default' : 'outline'
                                }>
                                    {candidate.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {formatDistanceToNow(new Date(candidate.createdAt), { addSuffix: true })}
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Actions</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem asChild>
                                            <Link href={`/dashboard/jobs/${jobId}/candidates/${candidate.id}`}>View Profile</Link>
                                        </DropdownMenuItem>
                                        {candidate.resumeUrl && (
                                            <DropdownMenuItem asChild>
                                                <a href={candidate.resumeUrl} target="_blank" rel="noopener noreferrer">View Resume</a>
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleStatusChange(candidate.id, 'interviewed')}>
                                            Move to Interview
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-red-600" onClick={() => handleStatusChange(candidate.id, 'rejected')}>
                                            Reject
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                    {candidates.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                                No candidates found. Upload resumes to get started.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
