import { z } from 'zod'

export const jobSchema = z.object({
    title: z.string().min(2, "Title must be at least 2 characters"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    requirements: z.string().optional(),
    skills: z.string().transform(str => str.split(',').map(s => s.trim()).filter(s => s.length > 0)),
    minExperience: z.coerce.number().min(0),
    location: z.string().optional(),
    type: z.enum(['full-time', 'part-time', 'contract', 'freelance', 'internship']).default('full-time'),
})

// Form schema: same shape but skills stays string (no transform) so react-hook-form types match
export const jobFormSchema = z.object({
    title: z.string().min(2, "Title must be at least 2 characters"),
    description: z.string().min(10, "Description must be at least 10 characters"),
    requirements: z.string().optional(),
    skills: z.string(),
    minExperience: z.coerce.number().min(0).default(0),
    location: z.string().optional(),
    type: z.enum(['full-time', 'part-time', 'contract', 'freelance', 'internship']).default('full-time'),
})

export type JobFormValues = z.infer<typeof jobSchema>
