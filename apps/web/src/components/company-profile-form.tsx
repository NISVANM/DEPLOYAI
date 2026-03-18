'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { updateCompany } from '@/lib/actions/company'
import { toast } from 'sonner'

export function CompanyProfileForm({ initialName }: { initialName: string }) {
    const [name, setName] = useState(initialName)
    const [saving, setSaving] = useState(false)

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        try {
            await updateCompany({ name })
            toast.success('Company profile saved')
        } catch {
            toast.error('Failed to save')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Company Profile</CardTitle>
                <CardDescription>Manage your company details.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Company Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My Company"
                        />
                    </div>
                    <Button type="submit" disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    )
}
