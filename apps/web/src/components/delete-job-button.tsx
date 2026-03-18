'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteJob } from '@/lib/actions/jobs'
import { toast } from 'sonner'

export function DeleteJobButton({
    jobId,
    jobTitle,
    iconOnly,
}: {
    jobId: string
    jobTitle: string
    iconOnly?: boolean
}) {
    const router = useRouter()
    const [deleting, setDeleting] = useState(false)

    const handleDelete = async () => {
        if (!confirm(`Delete "${jobTitle}"? All candidates for this job will also be removed. This cannot be undone.`)) return
        setDeleting(true)
        try {
            await deleteJob(jobId)
            toast.success('Job deleted')
            router.push('/dashboard/jobs')
            router.refresh()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to delete job')
        } finally {
            setDeleting(false)
        }
    }

    if (iconOnly) {
        return (
            <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={deleting}
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Delete job"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        )
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
            <Trash2 className="h-4 w-4 mr-1.5" />
            {deleting ? 'Deleting…' : 'Delete job'}
        </Button>
    )
}
