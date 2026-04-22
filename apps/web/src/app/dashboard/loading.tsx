import { Card, CardContent } from '@/components/ui/card'

export default function DashboardLoading() {
    return (
        <div className="flex flex-col gap-4">
            <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                        <CardContent className="pt-6">
                            <div className="h-4 w-24 animate-pulse rounded bg-muted mb-3" />
                            <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
        </div>
    )
}
