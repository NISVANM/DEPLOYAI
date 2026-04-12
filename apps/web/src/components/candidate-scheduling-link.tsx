'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createCandidateSchedulingLink } from '@/lib/actions/scheduling'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarClock } from 'lucide-react'

export function CandidateSchedulingLinkCard({ candidateId, jobId }: { candidateId: string; jobId: string }) {
    const [loading, setLoading] = useState(false)
    const [lastUrl, setLastUrl] = useState<string | null>(null)

    async function generate() {
        setLoading(true)
        try {
            const { url } = await createCandidateSchedulingLink(candidateId, jobId)
            setLastUrl(url)
            try {
                await navigator.clipboard.writeText(url)
                toast.success('Scheduling link copied to clipboard')
            } catch {
                toast.success('Scheduling link created — copy it below')
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not create scheduling link')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <CalendarClock className="h-5 w-5" />
                    Interview scheduling
                </CardTitle>
                <CardDescription>
                    When you move someone to <b>interview</b>, they also get this link by email (if SMTP is on). Use the button to copy the same invite link anytime — one active link per candidate and job.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <Button className="w-full" type="button" disabled={loading} onClick={generate}>
                    {loading ? 'Creating…' : 'Copy scheduling link'}
                </Button>
                {lastUrl && (
                    <p className="break-all rounded-md border bg-muted/50 p-2 text-xs text-muted-foreground">{lastUrl}</p>
                )}
            </CardContent>
        </Card>
    )
}
