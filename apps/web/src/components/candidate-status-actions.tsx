'use client'

import { Button } from '@/components/ui/button'
import { updateCandidateStatus } from '@/lib/actions/candidates'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { CandidateStatus } from '@/lib/integrations/types'

export function CandidateStatusActions({ candidateId, jobId, currentStatus }: { candidateId: string; jobId: string; currentStatus: string }) {
    const router = useRouter()
    const isLocked = currentStatus === 'hired'

    async function handleStatus(status: CandidateStatus) {
        try {
            await updateCandidateStatus(candidateId, status)
            const labels: Record<CandidateStatus, string> = {
                new: 'Moved to new',
                screening: 'Moved to screening',
                interviewed: 'Moved to interview',
                offered: 'Marked as offered',
                hired: 'Marked as hired',
                rejected: 'Candidate rejected',
            }
            toast.success(labels[status])
            router.refresh()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update status')
        }
    }

    return (
        <div className="ml-auto flex gap-2">
            <Button variant="outline" disabled={isLocked} onClick={() => handleStatus('rejected')}>
                Reject
            </Button>
            <Button disabled={isLocked} onClick={() => handleStatus('interviewed')}>
                Move to Interview
            </Button>
            <Button variant="secondary" disabled={isLocked} onClick={() => handleStatus('hired')}>
                Mark as Hired
            </Button>
        </div>
    )
}
