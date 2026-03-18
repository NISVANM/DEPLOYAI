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

## Deployment (Vercel)

This repo is a **monorepo**: the Next.js app lives in **`apps/web`**, not the repository root.

If Vercel’s **Root Directory** is left as `.` (repo root), the build never runs `next build` correctly and you get **`404: NOT_FOUND`** on the live URL.

1. Vercel → your project → **Settings** → **General**.
2. Under **Root Directory**, click **Edit** → set to **`apps/web`** → Save.
3. **Redeploy** (Deployments → ⋮ on latest → Redeploy).

Framework should stay **Next.js**. Copy env vars from `.env.example` into Vercel → **Settings** → **Environment Variables**.

### Jobs / “Database error” on production

Posting jobs uses **Postgres** via **`DATABASE_URL`** (not only Supabase Auth). You must:

1. **Create tables** in the **same** Supabase project as your auth keys: open **Supabase** → **SQL Editor**, run the scripts in order:
   - `apps/web/supabase/schema.sql`
   - `apps/web/supabase/rls.sql`  
   (If tables already exist, you may see harmless “already exists” errors—check that `jobs`, `companies`, etc. appear under **Table Editor**.)

2. **Set `DATABASE_URL` on Vercel** to that project’s connection string: **Supabase** → **Project Settings** → **Database** → **URI**. For serverless, prefer the **Transaction pooler** (port **6543**) string; ensure the password is correct (URL-encode special characters like `@` → `%40`).

3. **Redeploy** after adding or changing `DATABASE_URL`.

4. **Transaction pooler (port 6543)** on Vercel: prefer Supabase **Connection pooling** → **Transaction** URI (not direct `db.*.supabase.co:5432` if you see timeouts). The app uses **`postgres.js`** with **`prepare: false`** for the pooler.

5. **Vercel `DATABASE_URL`**: paste the URI **without** surrounding `"` quotes. If the toast still mentions **“drizzle-kit push”**, that deployment is **old** — open Vercel → **Deployments**, confirm the latest commit is **Ready**, then hard-refresh the site.
