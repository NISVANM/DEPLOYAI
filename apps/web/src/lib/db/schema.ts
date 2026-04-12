import { pgTable, serial, text, timestamp, uuid, jsonb, boolean, integer, real, primaryKey, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const candidateStatusEnum = pgEnum('candidate_status', ['new', 'screening', 'interviewed', 'offered', 'hired', 'rejected']);
export const roleEnum = pgEnum('role', ['owner', 'admin', 'member']);
export const integrationProviderEnum = pgEnum('integration_provider', ['generic_webhook', 'smtp', 'scheduling']);

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

export const integrationConfigs = pgTable('integration_configs', {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
    provider: integrationProviderEnum('provider').notNull(),
    enabled: boolean('enabled').default(false).notNull(),
    config: jsonb('config').default({}).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const webhookEvents = pgTable('webhook_events', {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
    candidateId: uuid('candidate_id').references(() => candidates.id, { onDelete: 'cascade' }).notNull(),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }).notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    nextRetryAt: timestamp('next_retry_at'),
    lastError: text('last_error'),
    deliveredAt: timestamp('delivered_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const emailTemplates = pgTable('email_templates', {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
    key: text('key').notNull(),
    subject: text('subject').notNull(),
    bodyHtml: text('body_html').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const emailEvents = pgTable('email_events', {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
    candidateId: uuid('candidate_id').references(() => candidates.id, { onDelete: 'cascade' }).notNull(),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }).notNull(),
    templateKey: text('template_key').notNull(),
    recipientEmail: text('recipient_email').notNull(),
    subject: text('subject').notNull(),
    bodyHtml: text('body_html').notNull(),
    status: text('status').default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    nextRetryAt: timestamp('next_retry_at'),
    providerMessageId: text('provider_message_id'),
    lastError: text('last_error'),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const schedulingProviderConfigs = pgTable('scheduling_provider_configs', {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
    provider: text('provider').default('none').notNull(),
    enabled: boolean('enabled').default(false).notNull(),
    config: jsonb('config').default({}).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const schedulingTokens = pgTable('scheduling_tokens', {
    id: uuid('id').defaultRandom().primaryKey(),
    companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }).notNull(),
    candidateId: uuid('candidate_id').references(() => candidates.id, { onDelete: 'cascade' }).notNull(),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }).notNull(),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
})

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
