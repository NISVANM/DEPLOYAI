import { listSchedulingInvitesForCompany } from '@/lib/actions/scheduling'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default async function SchedulingInvitesPage() {
    const invites = await listSchedulingInvitesForCompany().catch(() => [])

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold">Interview scheduling</h1>
                <p className="text-muted-foreground text-sm">
                    Invites created when a candidate moves to <b>interview</b> (email) or when you copy a link on their profile. Candidates open your app first, then Cal.com to pick a time.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent invite links</CardTitle>
                    <CardDescription>
                        Up to 50 most recent. Interview times sync from Cal.com when a{' '}
                        <strong>Cal.com API key</strong> is saved in Settings (matched by candidate email and booking time).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {invites.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No scheduling links yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-muted-foreground">
                                        <th className="pb-2 pr-4 font-medium">Candidate</th>
                                        <th className="pb-2 pr-4 font-medium">Job</th>
                                        <th className="pb-2 pr-4 font-medium">Interview scheduled</th>
                                        <th className="pb-2 pr-4 font-medium">Created</th>
                                        <th className="pb-2 pr-4 font-medium">Expires</th>
                                        <th className="pb-2 pr-4 font-medium">Status</th>
                                        <th className="pb-2 font-medium">Invite</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invites.map((row) => {
                                        const expired = row.expiresAt.getTime() <= Date.now()
                                        const used = row.usedAt != null
                                        return (
                                            <tr key={row.id} className="border-b border-muted/50">
                                                <td className="py-3 pr-4 align-top">{row.candidateName}</td>
                                                <td className="py-3 pr-4 align-top">{row.jobTitle}</td>
                                                <td className="py-3 pr-4 align-top whitespace-nowrap text-sm">
                                                    {row.interviewTimeKnown ? (
                                                        row.interviewAt ? (
                                                            row.interviewAt.toLocaleString(undefined, {
                                                                dateStyle: 'medium',
                                                                timeStyle: 'short',
                                                            })
                                                        ) : (
                                                            <span className="text-muted-foreground">Not booked yet</span>
                                                        )
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="py-3 pr-4 align-top whitespace-nowrap">
                                                    {row.createdAt.toLocaleString()}
                                                </td>
                                                <td className="py-3 pr-4 align-top whitespace-nowrap">
                                                    {row.expiresAt.toLocaleString()}
                                                </td>
                                                <td className="py-3 pr-4 align-top">
                                                    {used ? (
                                                        <Badge variant="secondary">Used</Badge>
                                                    ) : expired ? (
                                                        <Badge variant="outline">Expired</Badge>
                                                    ) : (
                                                        <Badge>Active</Badge>
                                                    )}
                                                </td>
                                                <td className="py-3 align-top max-w-[200px]">
                                                    <a
                                                        href={row.inviteUrl}
                                                        className="break-all text-xs text-primary underline underline-offset-2"
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        Open link
                                                    </a>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
                Raw invite URL (for support): copy from the candidate page or email. The <strong>Interview scheduled</strong> column loads from
                Cal.com bookings (same API key as Settings → Integrations). If it stays empty, confirm the key has booking read access and the
                candidate email matches their Cal.com booking. Full history remains in{' '}
                <Link href="https://cal.com" className="underline underline-offset-2" target="_blank" rel="noreferrer">
                    Cal.com
                </Link>
                .
            </p>
        </div>
    )
}
