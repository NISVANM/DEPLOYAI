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
   - **`DATABASE_URL`**: use Supabase **Transaction pooler** (port **6543**), not direct `db.*.supabase.co:5432`, if you see **`CONNECT_TIMEOUT`** or timeouts from localhost/Vercel.
   - Optional feature toggles for staged rollout: `FEATURE_CANDIDATE_EMAIL_AUTOMATION`, `FEATURE_SCHEDULING`. HRIS/hired webhooks use **Settings → HRIS Webhook**, not an env flag.

### DATABASE_URL (avoid timeouts)

1. Supabase → **Project Settings** → **Database**.
2. Under **Connection string**, choose **URI** and mode **Transaction** (pooler).
3. Copy the URI — host should look like `aws-0-…pooler.supabase.com` and port **`6543`**.
4. Put it in **`apps/web/.env.local`** as `DATABASE_URL=...` (no quotes). Restart `npm run dev`.
5. Use the **same** value on Vercel for production.

Direct connections (`db.PROJECT.supabase.co:5432`) often **time out** from home networks or serverless; the pooler is the supported fix.

**Still `CONNECT_TIMEOUT` on `…pooler.supabase.com:6543`?** The URL is usually correct; the TCP connection is not completing in time. Try: **resume** the Supabase project if it’s paused; **disable VPN** or use a **phone hotspot** (some networks block DB ports); in Supabase → Database, try **Session mode** URI (port **5432** on the pooler host) instead of Transaction. Optionally set `DATABASE_CONNECT_TIMEOUT_SEC=90` in `.env.local`.

3. **Database** (required or “Create job” will fail with a query error on `companies`):
   In the **same** Supabase project as `NEXT_PUBLIC_SUPABASE_URL` / `DATABASE_URL`, open **SQL Editor** and run **`supabase/schema.sql`** (full file). It is **safe to re-run** (enums/policies use “if not exists” patterns).

   - **`rls.sql`** is optional if `schema.sql` already ran (it overlaps). Use it only if you need to refresh policies without re-running the whole schema.

   If you see **`type "candidate_status" already exists`**, the database was already partly set up — your **`companies`** table can still exist (confirm with `select to_regclass('public.companies');`). Use the latest `schema.sql` from this repo so the script skips duplicate types, or stop re-running once tables exist.

   *Alternatively*, you can use Drizzle migrations:
   ```bash
   npx drizzle-kit generate
   npx drizzle-kit migrate
   ```

### Integration modules (safe rollout)

- **HRIS Webhook** (generic): sends signed JSON payload when candidate status changes to `hired`.
- **Candidate Email Automation**: SMTP-based stage emails using editable templates.
- **Interview scheduling (Cal.com)**: When a candidate’s status becomes **`interviewed`**, SMTP sends the stage email with **`{{schedulingLinkHtml}}`** (and `{{schedulingLink}}`) so they can book via your `/schedule/[token]` page → Cal.com. Admins see invites under **Dashboard → Scheduling**.

Email templates can be gated with env flags; **HRIS webhooks** are off until you enable them under **Settings** (no `FEATURE_*` env var required).

### Cal.com setup

1. In [Cal.com](https://cal.com) → **Settings → Developer** create an API key (`cal_live_` / `cal_test_`).
2. Note your public booking URL: `https://cal.com/<username>/<event-slug>` (username + event slug go in RecruitAI **Settings → Interview scheduling**).
3. In RecruitAI **Settings**, enable scheduling, choose **Cal.com**, paste API key and fields, **Save**, then **Test API connection**.
4. Set **`NEXT_PUBLIC_APP_URL`** on Vercel to your site URL so generated links are correct (e.g. `https://your-app.vercel.app`).
5. Configure **SMTP** (`SMTP_ENABLED`, host, user, password, from address) so interview emails actually send.
6. Move a candidate to **interview** — they receive the `candidate_status_interviewed` email with a booking link (if Cal.com is configured). The same link is reusable from **Copy scheduling link** on the candidate page.
7. Review generated links under **Dashboard → Scheduling**.

**Team / org event URLs** on Cal.com can differ from `cal.com/user/slug`. If your booking URL uses a team or organization path, you may need to adjust **Booking site origin** or use a personal event type until custom path support is added.

If you already saved a custom **interview** email template before this feature, edit it in Settings and add `{{schedulingLinkHtml}}` (or `{{schedulingLink}}`) where you want the booking link.

**Optional next steps:** Cal.com webhooks to mark tokens `used_at` after booking; sync confirmed times into RecruitAI; team slug–aware URL builder for every Cal.com URL shape.

### Google Sheets auto-insert on hired

You can auto-insert hired candidates into a Google Sheet by using an Apps Script Web App URL in Settings, under HRIS Webhook.

1) In Google Sheets, open Extensions -> Apps Script and add a doPost handler that appends request JSON fields into a `Hired` sheet.
2) Deploy as Web App (Execute as Me, access Anyone with link).
3) Copy the `/exec` URL and paste it into the `Google Sheet Apps Script URL` field in HRIS Webhook settings.
4) When candidate status becomes `hired`, RecruitAI will POST a sheet-friendly payload with fields like:
   `changedAt, candidateName, candidateEmail, candidatePhone, candidateScore, jobTitle, fromStatus, toStatus, candidateId, jobId`.

Also, once a candidate is marked `hired`, status changes are locked and cannot be changed again.

### Google Sheets auto-insert on `hired`

You can auto-insert hired candidates into a Google Sheet by using an Apps Script Web App URL in **Settings → HRIS Webhook → Google Sheet Apps Script URL**.

1. In Google Sheets: **Extensions → Apps Script** and paste:

```javascript
function doPost(e) {
  const payload = JSON.parse(e.postData.contents || '{}');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hired') || SpreadsheetApp.getActiveSpreadsheet().insertSheet('Hired');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['changedAt', 'candidateName', 'candidateEmail', 'candidatePhone', 'candidateScore', 'jobTitle', 'fromStatus', 'toStatus', 'candidateId', 'jobId']);
  }
  sheet.appendRow([
    payload.changedAt || '',
    payload.candidateName || '',
    payload.candidateEmail || '',
    payload.candidatePhone || '',
    payload.candidateScore || '',
    payload.jobTitle || '',
    payload.fromStatus || '',
    payload.toStatus || '',
    payload.candidateId || '',
    payload.jobId || ''
  ]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}
```

2. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone with link**
3. Copy the `/exec` URL and put it in **Google Sheet Apps Script URL**.
4. Mark a candidate as **hired** and check the `Hired` sheet for a new row.

Once a candidate is marked `hired`, status is locked and can no longer be changed.

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

### Performance (latency)

- **Middleware** only runs on `/dashboard`, `/login`, and `/signup` (not on `/`, APIs, or public scheduling links), so most requests skip an extra Supabase session round-trip.
- Use Supabase **transaction pooler** (`DATABASE_URL` on port **6543**) for fast DB access from Vercel.
- In **Vercel → Settings → Functions**, pick a **region** close to your users (see `vercel.json` `regions` if set).
- **Resume uploads**: large PDFs + AI calls are inherently slow; Groq is usually faster/cheaper than Gemini for parsing.

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

### SMTP / candidate emails (status “sent” but no message?)

The app marks an email **sent** after your SMTP server **accepts** the message (same as most apps). That is **not** a guarantee it reached the candidate’s inbox.

1. **Copy all `SMTP_*` variables to Vercel** (Production). Local `.env.local` does not apply on the server.
2. **Gmail**: use **`smtp.gmail.com`**, port **587**, **`SMTP_SECURE=false`**, and an **[App Password](https://support.google.com/accounts/answer/185833)** (not your normal login password). Set **`SMTP_USER`** and **`SMTP_FROM_EMAIL`** to the **same Gmail address** unless you’ve added a verified “Send mail as” alias.
3. **Sent folder**: mail sent via **SMTP often does not appear** in Gmail’s **Sent** UI — that is normal. Check **Vercel → Deployment → Functions / Logs** for a line like `[smtp] accepted` with a `messageId` to confirm the handoff to Google succeeded.
4. **Recipient**: confirm the **candidate’s email** on their profile is correct; check **Spam / Promotions** on the recipient account.
5. For production reliability, consider a transactional provider (**Resend**, **SendGrid**, **Postmark**) with their SMTP hostname and API-aligned from-address rules.
