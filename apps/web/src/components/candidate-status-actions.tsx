'use client'

import { Button } from '@/components/ui/button'
import { updateCandidateStatus } from '@/lib/actions/candidates'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function CandidateStatusActions({ candidateId, jobId }: { candidateId: string; jobId: string }) {
    const router = useRouter()

    async function handleStatus(status: 'interviewed' | 'rejected') {
        try {
            await updateCandidateStatus(candidateId, status)
            toast.success(status === 'interviewed' ? 'Moved to interview' : 'Candidate rejected')
            router.refresh()
        } catch {
            toast.error('Failed to update status')
        }
    }

    return (
        <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => handleStatus('rejected')}>
                Reject
            </Button>
            <Button onClick={() => handleStatus('interviewed')}>
                Move to Interview
            </Button>
        </div>
    )
}
