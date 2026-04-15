import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getCompany } from "@/lib/actions/company"
import { CompanyProfileForm } from "@/components/company-profile-form"
import { getIntegrationSettings } from "@/lib/actions/integrations"
import { IntegrationSettingsForm } from "@/components/integration-settings-form"

export default async function SettingsPage() {
    const [company, integrations] = await Promise.all([
        getCompany(),
        getIntegrationSettings().catch(() => null),
    ])

    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-bold">Settings</h1>

            <CompanyProfileForm initialName={company?.name ?? 'My Company'} />

            <Card>
                <CardHeader>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>Invite team members to collaborate.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 mb-4">
                        <Input placeholder="colleague@example.com" disabled />
                        <Button variant="secondary" disabled>Invite</Button>
                    </div>
                    <p className="text-sm text-muted-foreground">Team invites coming soon.</p>
                </CardContent>
            </Card>

            {integrations && <IntegrationSettingsForm {...integrations} />}
        </div>
    )
}
