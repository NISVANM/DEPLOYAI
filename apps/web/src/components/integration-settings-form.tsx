'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
    retryPendingIntegrations,
    sendTestWebhook,
    updateSchedulingConfig,
    updateWebhookConfig,
    upsertEmailTemplate,
} from '@/lib/actions/integrations'
import { testCalcomApiConnection } from '@/lib/actions/scheduling'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

type Template = {
    id: string
    key: string
    subject: string
    bodyHtml: string
    enabled: boolean
}

type IntegrationSettingsProps = {
    featureSchedulingUi: boolean
    webhook: {
        enabled: boolean
        url: string
        secret: string
        googleSheetWebhookUrl?: string
    }
    scheduling: {
        enabled: boolean
        provider: string
        calcom: {
            hasApiKey: boolean
            apiKeyLast4: string
            bookingBaseUrl: string
            apiBaseUrl: string
            username: string
            eventSlug: string
            organizationSlug: string
            teamSlug: string
        }
    }
    templates: Template[]
    recentWebhookEvents: Array<{ id: string; eventType: string; status: string; createdAt: Date; lastError: string | null }>
    recentEmailEvents: Array<{ id: string; templateKey: string; recipientEmail: string; status: string; createdAt: Date; lastError: string | null }>
}

const STATUS_TEMPLATE_KEYS = ['candidate_status_new', 'candidate_status_screening', 'candidate_status_interviewed', 'candidate_status_offered', 'candidate_status_hired', 'candidate_status_rejected']

export function IntegrationSettingsForm(props: IntegrationSettingsProps) {
    const [savingWebhook, setSavingWebhook] = useState(false)
    const [testingWebhook, setTestingWebhook] = useState(false)
    const [savingTemplate, setSavingTemplate] = useState<string | null>(null)
    const [retrying, setRetrying] = useState(false)
    const [savingScheduling, setSavingScheduling] = useState(false)
    const [testingCalcom, setTestingCalcom] = useState(false)

    const [webhookEnabled, setWebhookEnabled] = useState(props.webhook.enabled)
    const [webhookUrl, setWebhookUrl] = useState(props.webhook.url)
    const [webhookSecret, setWebhookSecret] = useState(props.webhook.secret)
    const [googleSheetWebhookUrl, setGoogleSheetWebhookUrl] = useState(props.webhook.googleSheetWebhookUrl ?? '')

    const [schedulingEnabled, setSchedulingEnabled] = useState(props.scheduling.enabled)
    const [schedulingProvider, setSchedulingProvider] = useState(
        props.scheduling.provider === 'calcom' || props.scheduling.provider === 'none' ? props.scheduling.provider : 'none'
    )
    const [calcomBookingBaseUrl, setCalcomBookingBaseUrl] = useState(props.scheduling.calcom.bookingBaseUrl)
    const [calcomApiBaseUrl, setCalcomApiBaseUrl] = useState(props.scheduling.calcom.apiBaseUrl)
    const [calcomUsername, setCalcomUsername] = useState(props.scheduling.calcom.username)
    const [calcomEventSlug, setCalcomEventSlug] = useState(props.scheduling.calcom.eventSlug)
    const [calcomOrgSlug, setCalcomOrgSlug] = useState(props.scheduling.calcom.organizationSlug)
    const [calcomTeamSlug, setCalcomTeamSlug] = useState(props.scheduling.calcom.teamSlug)
    const [calcomApiKey, setCalcomApiKey] = useState('')

    const templateMap = useMemo(() => {
        const map = new Map<string, Template>()
        for (const t of props.templates) map.set(t.key, t)
        return map
    }, [props.templates])

    async function onSaveWebhook(e: React.FormEvent) {
        e.preventDefault()
        setSavingWebhook(true)
        try {
            await updateWebhookConfig({
                enabled: webhookEnabled,
                url: webhookUrl,
                secret: webhookSecret,
                googleSheetWebhookUrl,
            })
            toast.success('Webhook settings saved')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save webhook settings')
        } finally {
            setSavingWebhook(false)
        }
    }

    async function onTestWebhook() {
        setTestingWebhook(true)
        try {
            await sendTestWebhook()
            toast.success('Test webhook sent successfully')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Test webhook failed')
        } finally {
            setTestingWebhook(false)
        }
    }

    async function onSaveScheduling(e: React.FormEvent) {
        e.preventDefault()
        setSavingScheduling(true)
        try {
            await updateSchedulingConfig({
                enabled: schedulingEnabled,
                provider: schedulingProvider,
                calcomApiKey,
                calcomBookingBaseUrl,
                calcomApiBaseUrl,
                calcomUsername,
                calcomEventSlug,
                calcomOrganizationSlug: calcomOrgSlug,
                calcomTeamSlug,
            })
            setCalcomApiKey('')
            toast.success('Scheduling settings saved')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save scheduling settings')
        } finally {
            setSavingScheduling(false)
        }
    }

    async function onTestCalcom() {
        setTestingCalcom(true)
        try {
            const r = await testCalcomApiConnection()
            toast.success(`Cal.com connection OK (${r.eventTypeCount} event type(s) returned)`)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Cal.com test failed')
        } finally {
            setTestingCalcom(false)
        }
    }

    async function onSaveTemplate(key: string, subject: string, bodyHtml: string, enabled: boolean) {
        setSavingTemplate(key)
        try {
            await upsertEmailTemplate({ key, subject, bodyHtml, enabled })
            toast.success(`Saved template: ${key}`)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save template')
        } finally {
            setSavingTemplate(null)
        }
    }

    async function onRetryPending() {
        setRetrying(true)
        try {
            const result = await retryPendingIntegrations()
            toast.success(`Retry started: ${result.webhookRetried} webhooks, ${result.emailRetried} emails`)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to retry pending events')
        } finally {
            setRetrying(false)
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>HRIS Webhook</CardTitle>
                    <CardDescription>Send candidate hired events to your HRIS/onboarding system.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="space-y-4" onSubmit={onSaveWebhook}>
                        <div className="flex items-center justify-between rounded-md border p-3">
                            <div>
                                <p className="font-medium">Enable generic webhook</p>
                                <p className="text-sm text-muted-foreground">Triggered when candidate status changes to hired.</p>
                            </div>
                            <Switch checked={webhookEnabled} onCheckedChange={setWebhookEnabled} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="webhook-url">Webhook URL</Label>
                            <Input id="webhook-url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://example.com/webhooks/recruitai" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="webhook-secret">Webhook Secret</Label>
                            <Input id="webhook-secret" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="optional-shared-secret" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="google-sheet-webhook-url">Google Sheet Apps Script URL (optional)</Label>
                            <Input
                                id="google-sheet-webhook-url"
                                value={googleSheetWebhookUrl}
                                onChange={(e) => setGoogleSheetWebhookUrl(e.target.value)}
                                placeholder="https://script.google.com/macros/s/.../exec"
                            />
                            <p className="text-xs text-muted-foreground">
                                When a candidate is marked as hired, this URL also receives a sheet-friendly payload.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button disabled={savingWebhook} type="submit">{savingWebhook ? 'Saving...' : 'Save Webhook Settings'}</Button>
                            <Button type="button" variant="secondary" disabled={testingWebhook} onClick={onTestWebhook}>
                                {testingWebhook ? 'Sending...' : 'Send Test Webhook'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {props.featureSchedulingUi && (
                <Card>
                    <CardHeader>
                        <CardTitle>Interview scheduling (Cal.com)</CardTitle>
                        <CardDescription>
                            Connect Cal.com so recruiters can generate candidate links. Links open your public page, then Cal.com to pick a time.
                            Set <code className="rounded bg-muted px-1 text-xs">NEXT_PUBLIC_APP_URL</code> on Vercel so links use your production domain.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-4" onSubmit={onSaveScheduling}>
                            <div className="flex items-center justify-between rounded-md border p-3">
                                <div>
                                    <p className="font-medium">Enable Cal.com scheduling</p>
                                    <p className="text-sm text-muted-foreground">Required for the candidate scheduling card on job pages.</p>
                                </div>
                                <Switch checked={schedulingEnabled} onCheckedChange={setSchedulingEnabled} />
                            </div>
                            <div className="space-y-2">
                                <Label>Provider</Label>
                                <Select value={schedulingProvider} onValueChange={setSchedulingProvider}>
                                    <SelectTrigger className="w-full max-w-md">
                                        <SelectValue placeholder="Choose provider" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        <SelectItem value="calcom">Cal.com</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {schedulingProvider === 'calcom' && (
                                <div className="space-y-4 rounded-md border p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Create an API key in Cal.com → Settings → Developer → API keys. Use the booking username and event slug from your public booking URL{' '}
                                        (<span className="font-mono text-xs">cal.com/username/event-slug</span>).
                                    </p>
                                    <div className="space-y-2">
                                        <Label htmlFor="calcom-api-key">API key</Label>
                                        <Input
                                            id="calcom-api-key"
                                            type="password"
                                            autoComplete="off"
                                            value={calcomApiKey}
                                            onChange={(e) => setCalcomApiKey(e.target.value)}
                                            placeholder={props.scheduling.calcom.hasApiKey ? `Leave blank to keep existing (…${props.scheduling.calcom.apiKeyLast4})` : 'cal_live_… or cal_test_…'}
                                        />
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="calcom-booking-base">Booking site origin</Label>
                                            <Input
                                                id="calcom-booking-base"
                                                value={calcomBookingBaseUrl}
                                                onChange={(e) => setCalcomBookingBaseUrl(e.target.value)}
                                                placeholder="https://cal.com"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="calcom-api-base">API base URL</Label>
                                            <Input
                                                id="calcom-api-base"
                                                value={calcomApiBaseUrl}
                                                onChange={(e) => setCalcomApiBaseUrl(e.target.value)}
                                                placeholder="https://api.cal.com"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="calcom-username">Username (from URL)</Label>
                                            <Input
                                                id="calcom-username"
                                                value={calcomUsername}
                                                onChange={(e) => setCalcomUsername(e.target.value)}
                                                placeholder="yourname"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="calcom-event-slug">Event slug</Label>
                                            <Input
                                                id="calcom-event-slug"
                                                value={calcomEventSlug}
                                                onChange={(e) => setCalcomEventSlug(e.target.value)}
                                                placeholder="30min"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="calcom-org-slug">Organization slug (optional)</Label>
                                            <Input
                                                id="calcom-org-slug"
                                                value={calcomOrgSlug}
                                                onChange={(e) => setCalcomOrgSlug(e.target.value)}
                                                placeholder="only if booking URL includes /org/"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="calcom-team-slug">Team slug (optional)</Label>
                                            <Input
                                                id="calcom-team-slug"
                                                value={calcomTeamSlug}
                                                onChange={(e) => setCalcomTeamSlug(e.target.value)}
                                                placeholder="team events only"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button type="button" variant="secondary" disabled={testingCalcom} onClick={onTestCalcom}>
                                            {testingCalcom ? 'Testing…' : 'Test API connection'}
                                        </Button>
                                        <p className="text-xs text-muted-foreground self-center">Save your API key first, then test.</p>
                                    </div>
                                </div>
                            )}

                            <Button disabled={savingScheduling} type="submit">
                                {savingScheduling ? 'Saving...' : 'Save scheduling settings'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Email Templates</CardTitle>
                    <CardDescription>Templates used for stage-triggered candidate emails.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {STATUS_TEMPLATE_KEYS.map((key) => (
                        <TemplateEditor
                            key={key}
                            templateKey={key}
                            initial={templateMap.get(key)}
                            onSave={onSaveTemplate}
                            saving={savingTemplate === key}
                        />
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Delivery Monitor</CardTitle>
                    <CardDescription>Recent webhook/email deliveries and manual retry.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button variant="secondary" onClick={onRetryPending} disabled={retrying}>
                        {retrying ? 'Retrying...' : 'Retry Pending Deliveries'}
                    </Button>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-md border p-3">
                            <p className="mb-2 text-sm font-medium">Webhook Events</p>
                            <div className="space-y-2 text-xs">
                                {props.recentWebhookEvents.length === 0 && <p className="text-muted-foreground">No webhook events yet.</p>}
                                {props.recentWebhookEvents.map((event) => (
                                    <div key={event.id} className="rounded border p-2">
                                        <p><b>{event.eventType}</b> · {event.status}</p>
                                        <p className="text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
                                        {event.lastError && <p className="text-red-600">{event.lastError}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="rounded-md border p-3">
                            <p className="mb-2 text-sm font-medium">Email Events</p>
                            <div className="space-y-2 text-xs">
                                {props.recentEmailEvents.length === 0 && <p className="text-muted-foreground">No email events yet.</p>}
                                {props.recentEmailEvents.map((event) => (
                                    <div key={event.id} className="rounded border p-2">
                                        <p><b>{event.templateKey}</b> · {event.status}</p>
                                        <p className="text-muted-foreground">{event.recipientEmail}</p>
                                        <p className="text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
                                        {event.lastError && <p className="text-red-600">{event.lastError}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

function TemplateEditor({
    templateKey,
    initial,
    onSave,
    saving,
}: {
    templateKey: string
    initial?: Template
    onSave: (key: string, subject: string, bodyHtml: string, enabled: boolean) => Promise<void>
    saving: boolean
}) {
    const [subject, setSubject] = useState(initial?.subject ?? `Status Update: ${templateKey.replace('candidate_status_', '')}`)
    const [bodyHtml, setBodyHtml] = useState(
        initial?.bodyHtml ??
            (templateKey === 'candidate_status_interviewed'
                ? '<p>Hi {{candidateName}},</p><p>Your application for <b>{{jobTitle}}</b> has moved to <b>interview</b>.</p>{{schedulingLinkHtml}}<p>Thanks,<br/>{{companyName}}</p>'
                : '<p>Hi {{candidateName}},</p><p>Your application for {{jobTitle}} moved to <b>{{status}}</b>.</p><p>Thanks,<br/>{{companyName}}</p>')
    )
    const [enabled, setEnabled] = useState(initial?.enabled ?? true)

    return (
        <form
            className="space-y-3 rounded-md border p-3"
            onSubmit={async (e) => {
                e.preventDefault()
                await onSave(templateKey, subject, bodyHtml, enabled)
            }}
        >
            <div className="flex items-center justify-between">
                <p className="font-medium">{templateKey}</p>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Body (HTML)</Label>
                <Textarea rows={4} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
                Placeholders: {'{{candidateName}}'}, {'{{jobTitle}}'}, {'{{status}}'}, {'{{companyName}}'}
                {templateKey === 'candidate_status_interviewed' && (
                    <>, {'{{schedulingLink}}'} (URL), {'{{schedulingLinkHtml}}'} (paragraph with link)</>
                )}
            </p>
            <Button size="sm" disabled={saving} type="submit">{saving ? 'Saving...' : 'Save Template'}</Button>
        </form>
    )
}

