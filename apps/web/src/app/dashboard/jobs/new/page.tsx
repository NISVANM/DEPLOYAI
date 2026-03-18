import { JobForm } from "@/components/job-form"

export default function NewJobPage() {
    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">Post a New Job</h1>
                <p className="text-muted-foreground">Fill in the details below to start recruiting.</p>
            </div>
            <JobForm />
        </div>
    )
}
