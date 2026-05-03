'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { Resolver } from 'react-hook-form'
import { z } from 'zod'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { createJob } from '@/lib/actions/jobs'
import { jobFormSchema } from '@/lib/schemas/jobs'
import { JOB_TITLES_LIST, ALL_SKILLS_LIST, getSkillsForJobTitle } from '@/lib/data/job-titles-with-skills'

const TITLE_DATALIST_ID = 'job-title-datalist'
const SKILLS_DATALIST_ID = 'job-skills-datalist'

/** Server actions that call `redirect()` throw this; it is success, not failure. */
function isNextRedirectError(error: unknown): boolean {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') return true
    if (typeof error !== 'object' || error === null) return false
    const digest = 'digest' in error ? String((error as { digest?: unknown }).digest) : ''
    return digest.startsWith('NEXT_REDIRECT')
}

function parseSkillsString(s: string): string[] {
    if (typeof s !== 'string') return []
    return s.split(',').map((x) => x.trim()).filter(Boolean)
}

function toSkillsString(arr: string[]): string {
    return [...new Set(arr)].filter(Boolean).join(', ')
}

export function JobForm() {
    const [isPending, setIsPending] = useState(false)
    const form = useForm<z.infer<typeof jobFormSchema>>({
        resolver: zodResolver(jobFormSchema) as Resolver<z.infer<typeof jobFormSchema>>,
        defaultValues: {
            title: '',
            description: '',
            requirements: '',
            skills: '',
            requiredSkills: [],
            minExperience: 0,
            location: '',
            type: 'full-time',
        },
    })
    const watchedTitle = form.watch('title')
    const suggestedSkills = useMemo(
        () => getSkillsForJobTitle(watchedTitle ?? ''),
        [watchedTitle]
    )

    async function onSubmit(values: z.infer<typeof jobFormSchema>) {
        setIsPending(true)
        try {
            // Need to convert skills array to comma separated string if the server action expects strict schema matching the form
            // But our schema defines skills as array transform. 
            // Actually the server action uses the schema which expects a string input for transform? 
            // Wait, the schema `skills: z.string().transform(...)` means the input is string.
            // So the form should probably use a string input and let Zod transform it.
            // But `defaultValues.skills` is [], which conflicts if the schema expects string input.
            // I need to adjust the schema or the form.

            // Let's adjust the form to send the data as expected by the server action.
            // The server action calls `jobSchema.safeParse(formData)`.
            // If I use `z.string().transform()`, `safeParse` expects a string.
            // So the form state for `skills` should be a string (comma separated).

            // I will assume the form handles `skills` as a string for now provided by Input.

            const result = await createJob(values)
            if (result?.error) {
                const err = result.error as { formErrors?: string[] }
                const msg = err.formErrors?.[0] ?? 'Failed to create job'
                toast.error(msg)
                return
            }
            toast.success('Job created successfully')
        } catch (error) {
            if (isNextRedirectError(error)) {
                toast.success('Job created successfully')
                return
            }
            const message = error instanceof Error ? error.message : 'Failed to create job'
            toast.error(message)
            console.error(error)
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Job Title</FormLabel>
                            <FormControl>
                                <div>
                                    <Input
                                        placeholder="Select or type a job title (e.g. Senior Frontend Engineer)"
                                        list={TITLE_DATALIST_ID}
                                        {...field}
                                    />
                                    <datalist id={TITLE_DATALIST_ID}>
                                        {JOB_TITLES_LIST.map((t) => (
                                            <option key={t} value={t} />
                                        ))}
                                    </datalist>
                                </div>
                            </FormControl>
                            <FormDescription>Pick from the list or enter your own title.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Employment Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="full-time">Full-time</SelectItem>
                                        <SelectItem value="part-time">Part-time</SelectItem>
                                        <SelectItem value="contract">Contract</SelectItem>
                                        <SelectItem value="freelance">Freelance</SelectItem>
                                        <SelectItem value="internship">Internship</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="minExperience"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Min. Experience (Years)</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                                <Input placeholder="San Francisco, CA (or Remote)" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="skills"
                    render={({ field }) => {
                        const currentSkills = parseSkillsString(Array.isArray(field.value) ? field.value.join(', ') : (field.value ?? ''))
                        const selectedRequiredSkills = form.watch('requiredSkills') ?? []
                        const addSkill = (skill: string) => {
                            const next = toSkillsString([...currentSkills, skill])
                            field.onChange(next)
                        }
                        const addAllSuggested = () => {
                            const merged = [...currentSkills, ...suggestedSkills]
                            field.onChange(toSkillsString(merged))
                        }
                        const suggestedNotAdded = suggestedSkills.filter((s) => !currentSkills.map((c) => c.toLowerCase()).includes(s.toLowerCase()))
                        return (
                            <FormItem>
                                <FormLabel>Required Skills (Comma separated)</FormLabel>
                                <FormControl>
                                    <div>
                                        <Input
                                            value={Array.isArray(field.value) ? field.value.join(', ') : field.value}
                                            onChange={(e) => {
                                                const nextSkills = parseSkillsString(e.target.value)
                                                const nextRequired = selectedRequiredSkills.filter((required) => nextSkills.includes(required))
                                                form.setValue('requiredSkills', nextRequired, { shouldDirty: true, shouldValidate: true })
                                                field.onChange(e.target.value)
                                            }}
                                            placeholder="Pick from list or type skills (comma-separated)"
                                            list={SKILLS_DATALIST_ID}
                                        />
                                        <datalist id={SKILLS_DATALIST_ID}>
                                            {ALL_SKILLS_LIST.map((s) => (
                                                <option key={s} value={s} />
                                            ))}
                                        </datalist>
                                    </div>
                                </FormControl>
                                <FormDescription>Pick skills from the list or type your own comma-separated.</FormDescription>
                                {suggestedSkills.length > 0 && (
                                    <div className="mt-2 space-y-1.5">
                                        <p className="text-sm text-muted-foreground">Suggested for this title:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {suggestedNotAdded.map((skill) => (
                                                <Badge
                                                    key={skill}
                                                    variant="secondary"
                                                    className="cursor-pointer hover:bg-primary/20"
                                                    onClick={() => addSkill(skill)}
                                                >
                                                    + {skill}
                                                </Badge>
                                            ))}
                                            {suggestedNotAdded.length > 0 && (
                                                <Button type="button" variant="outline" size="sm" onClick={addAllSuggested}>
                                                    Add all suggested
                                                </Button>
                                            )}
                                            {suggestedNotAdded.length === 0 && suggestedSkills.length > 0 && (
                                                <span className="text-sm text-muted-foreground">All suggested skills added.</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {currentSkills.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        <p className="text-sm text-muted-foreground">
                                            Mark must-have skills (candidates missing these are marked as not qualified):
                                        </p>
                                        <div className="grid gap-2">
                                            {currentSkills.map((skill) => {
                                                const checked = selectedRequiredSkills.includes(skill)
                                                return (
                                                    <label
                                                        key={skill}
                                                        className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
                                                    >
                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={(state) => {
                                                                const next = new Set(selectedRequiredSkills)
                                                                if (state) next.add(skill)
                                                                else next.delete(skill)
                                                                form.setValue('requiredSkills', Array.from(next), {
                                                                    shouldDirty: true,
                                                                    shouldValidate: true,
                                                                })
                                                            }}
                                                        />
                                                        <span>{skill}</span>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                                <FormMessage />
                            </FormItem>
                        )
                    }}
                />

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Job Description</FormLabel>
                            <FormControl>
                                <Textarea placeholder="Describe the role..." className="min-h-[150px]" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" disabled={isPending}>
                    {isPending ? 'Creating...' : 'Create Job'}
                </Button>
            </form>
        </Form>
    )
}
