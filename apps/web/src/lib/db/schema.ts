import { pgTable, serial, text, timestamp, uuid, jsonb, boolean, integer, real, primaryKey, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const candidateStatusEnum = pgEnum('candidate_status', ['new', 'screening', 'interviewed', 'offered', 'rejected']);
export const roleEnum = pgEnum('role', ['owner', 'admin', 'member']);

export const companies = pgTable('companies', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    ownerId: uuid('owner_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const companyMemberships = pgTable('company_memberships', {
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').notNull(),
    role: roleEnum('role').default('member').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
    pk: primaryKey({ columns: [t.companyId, t.userId] }),
}));

export const jobs = pgTable('jobs', {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    requirements: text('requirements'),
    skills: text('skills').array(),
    minExperience: integer('min_experience').default(0),
    location: text('location'),
    type: text('type').default('full-time'),
    status: text('status').default('active'), // active, closed, draft
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const candidates = pgTable('candidates', {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }).notNull(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    resumeUrl: text('resume_url'),
    parsedData: jsonb('parsed_data'), // Extracted resume data
    skills: text('skills').array(), // Extracted skills
    experience: jsonb('experience'), // Detailed experience
    education: jsonb('education'),
    score: real('score'), // 0-100 match score
    matchAnalysis: jsonb('match_analysis'), // Reasons for score
    status: candidateStatusEnum('status').default('new').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
    members: many(companyMemberships),
    jobs: many(jobs),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
    company: one(companies, {
        fields: [jobs.companyId],
        references: [companies.id],
    }),
    candidates: many(candidates),
}));

export const candidatesRelations = relations(candidates, ({ one }) => ({
    job: one(jobs, {
        fields: [candidates.jobId],
        references: [jobs.id],
    }),
    company: one(companies, {
        fields: [candidates.companyId],
        references: [companies.id],
    }),
}));
