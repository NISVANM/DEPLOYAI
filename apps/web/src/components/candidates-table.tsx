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
import { MoreHorizontal } from 'lucide-react'
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
import type { CandidateStatus } from '@/lib/integrations/types'

interface Candidate {
    id: string
    name: string
    email: string
    score: number | null
    status: string
    createdAt: Date
    skills: string[] | null
    resumeUrl?: string | null
    missingRequiredSkills?: string[]
}

export function CandidatesTable({
    jobId,
    candidates,
    showRank = true,
}: {
    jobId: string
    candidates: Candidate[]
    showRank?: boolean
}) {
    const router = useRouter()

    async function handleStatusChange(candidateId: string, status: CandidateStatus) {
        try {
            await updateCandidateStatus(candidateId, status)
            const labels: Record<CandidateStatus, string> = {
                new: 'Candidate moved to new',
                screening: 'Candidate moved to screening',
                interviewed: 'Moved to interview',
                offered: 'Candidate marked as offered',
                hired: 'Candidate marked as hired',
                rejected: 'Candidate rejected',
            }
            toast.success(labels[status])
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
                        {showRank ? <TableHead>Rank</TableHead> : null}
                        <TableHead>Candidate</TableHead>
                        <TableHead>Match Score</TableHead>
                        <TableHead>Skills Match</TableHead>
                        <TableHead>Missing Skills</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Applied</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {candidates.map((candidate, index) => (
                        <TableRow key={candidate.id}>
                            {showRank ? <TableCell className="font-medium">#{index + 1}</TableCell> : null}
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
                                <div className="flex flex-wrap gap-1">
                                    {(candidate.missingRequiredSkills ?? []).length > 0 ? (
                                        <>
                                            {candidate.missingRequiredSkills?.slice(0, 2).map((skill) => (
                                                <Badge key={skill} variant="outline" className="text-[10px] border-red-300 text-red-700">
                                                    {skill}
                                                </Badge>
                                            ))}
                                            {(candidate.missingRequiredSkills?.length ?? 0) > 2 && (
                                                <Badge variant="outline" className="text-[10px]">
                                                    +{(candidate.missingRequiredSkills?.length ?? 0) - 2}
                                                </Badge>
                                            )}
                                        </>
                                    ) : (
                                        <Badge variant="secondary" className="text-[10px]">None</Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={
                                    candidate.status === 'new' ? 'secondary' :
                                        candidate.status === 'interviewed' ? 'default' :
                                            candidate.status === 'hired' ? 'default' : 'outline'
                                }>
                                    {candidate.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {formatDistanceToNow(new Date(candidate.createdAt), { addSuffix: true })}
                            </TableCell>
                            <TableCell className="text-right">
                                {candidate.status === 'hired' ? (
                                    <Badge variant="secondary">Locked (Hired)</Badge>
                                ) : (
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
                                        <DropdownMenuItem onClick={() => handleStatusChange(candidate.id, 'offered')}>
                                            Mark as Offered
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleStatusChange(candidate.id, 'hired')}>
                                            Mark as Hired
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-red-600" onClick={() => handleStatusChange(candidate.id, 'rejected')}>
                                            Reject
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                    {candidates.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={showRank ? 8 : 7} className="h-24 text-center">
                                No candidates found. Upload resumes to get started.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
