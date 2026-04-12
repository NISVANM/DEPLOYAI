import { getPublicScheduleByToken } from '@/lib/actions/scheduling'
import { Button } from '@/components/ui/button'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function PublicSchedulePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const data = await getPublicScheduleByToken(token)
    if (!data) notFound()

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-6">
            <div className="w-full max-w-lg space-y-6 rounded-xl border bg-card p-8 text-center shadow-sm">
                <div className="space-y-2">
                    <h1 className="text-2xl font-semibold tracking-tight">Schedule your interview</h1>
                    <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">{data.jobTitle}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Hi {data.candidateFirstName}, you&apos;ll open Cal.com to pick a time that works for you.
                    </p>
                </div>
                <Button asChild className="w-full" size="lg">
                    <a href={data.calcomUrl} target="_blank" rel="noopener noreferrer">
                        Choose a time
                    </a>
                </Button>
                <p className="text-xs text-muted-foreground">
                    Link expires {new Date(data.expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.
                </p>
                <p className="text-xs text-muted-foreground">
                    Powered by{' '}
                    <Link href="https://cal.com" className="underline underline-offset-2" target="_blank" rel="noreferrer">
                        Cal.com
                    </Link>
                    .
                </p>
            </div>
        </div>
    )
}
