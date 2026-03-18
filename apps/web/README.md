# RecruitAI

Smart Candidate Screening & Ranking System.

## Features

- **Multi-tenant Dashboard**: Manage jobs and candidates per company.
- **AI Resume Parsing**: Extract structured data from PDF/DOCX resumes using Google Gemini (gemini-1.5-flash).
- **Smart Screening**: Score candidates based on job requirements.
- **Ranking**: Detailed formatted analysis of candidate fit.
- **Authentication**: Secure Supabase Auth with RLS.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Shadcn UI.
- **Backend**: Next.js Server Actions, Supabase (Postgres, Auth, Storage).
- **Database**: Drizzle ORM + Postgres.
- **AI**: Google Gemini API (Free Tier).

## Setup

1. **Clone & Install**:
   ```bash
   cd apps/web
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env.local` and fill in:
   - Supabase URL & Keys
   - `GEMINI_API_KEY` (Get from Google AI Studio)
   - Database URL (Transaction Pooler)

3. **Database**:
   Run the full schema SQL script in your Supabase SQL Editor: `supabase/schema.sql`.
   
   This script creates all necessary tables and RLS policies.
   
   *Alternatively*, you can use Drizzle migrations:
   ```bash
   npx drizzle-kit generate
   npx drizzle-kit migrate
   ```

4. **Run Locally**:
   ```bash
   npm run dev
   ```

## Where to find keys

### Supabase Keys & URL
1. go to your Supabase Project Dashboard.
2. Click on the **Settings** icon (cogwheel) at the bottom of the left sidebar.
3. Select **API**.
4. copy **Project URL** -> `NEXT_PUBLIC_SUPABASE_URL`
5. copy **anon public** key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. copy **service_role** key (click Reveal) -> `SUPABASE_SERVICE_ROLE_KEY`

### Database URL
1. In Supabase Dashboard, go to **Project Settings** -> **Database**.
2. Scroll to **Connection parameters** or **Connection string**.
3. Select **URI** tab. It starts with `postgres://...`.
4. Copy it to `DATABASE_URL`.
5. **IMPORTANT**: Replace `[YOUR-PASSWORD]` with the password you set when creating the project. If you forgot it, you can reset it in the same Database settings page.
6. Use port `6543` for Transaction Pooler (recommended for serverless) or `5432` for direct connection.

### Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Click **Get API key**.
3. Create a key in a new or existing project.
4. Copy it to `GEMINI_API_KEY`.

### Stripe Keys (Optional)
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys).
2. Ensure you are in **Test Mode** (toggle in top right).
3. Copy **Publishable key** -> `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
4. Copy **Secret key** -> `STRIPE_SECRET_KEY`

## Deployment

Deploy to Vercel. Ensure all environment variables are set.
