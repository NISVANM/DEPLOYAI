-- 1. Create ENUMs (safe to re-run: skips if types already exist)
DO $$ BEGIN
  CREATE TYPE candidate_status AS ENUM ('new', 'screening', 'interviewed', 'offered', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE candidate_status ADD VALUE IF NOT EXISTS 'hired';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE role AS ENUM ('owner', 'admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE integration_provider AS ENUM ('generic_webhook', 'smtp', 'scheduling');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create Tables
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_id uuid NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS company_memberships (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role role NOT NULL DEFAULT 'member',
  created_at timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY (company_id, user_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  requirements text,
  skills text[],
  min_experience integer DEFAULT 0,
  location text,
  type text DEFAULT 'full-time',
  status text DEFAULT 'active',
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  resume_url text,
  parsed_data jsonb,
  skills text[],
  experience jsonb,
  education jsonb,
  score real,
  match_analysis jsonb,
  status candidate_status NOT NULL DEFAULT 'new',
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS integration_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider integration_provider NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  UNIQUE (company_id, provider)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamp,
  last_error text,
  delivered_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  UNIQUE (company_id, key)
);

CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamp,
  provider_message_id text,
  last_error text,
  sent_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduling_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'none',
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  UNIQUE (company_id)
);

CREATE TABLE IF NOT EXISTS scheduling_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL
);

-- 3. Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_tokens ENABLE ROW LEVEL SECURITY;

-- 4. RLS Helper Function
CREATE OR REPLACE FUNCTION has_role_on_company(lookup_company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM company_memberships cm
    WHERE cm.company_id = lookup_company_id
      AND cm.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLS Policies (DROP + CREATE so re-runs do not fail)

-- Companies
DROP POLICY IF EXISTS "Users can view companies they are members of" ON companies;
CREATE POLICY "Users can view companies they are members of" ON companies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = companies.id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert companies" ON companies;
CREATE POLICY "Users can insert companies" ON companies
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Company Memberships
DROP POLICY IF EXISTS "Users can view memberships of their companies" ON company_memberships;
CREATE POLICY "Users can view memberships of their companies" ON company_memberships
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can manage memberships" ON company_memberships;
CREATE POLICY "Owners can manage memberships" ON company_memberships
  FOR ALL USING (
    EXISTS (
        SELECT 1 FROM companies c
        WHERE c.id = company_memberships.company_id AND c.owner_id = auth.uid()
    )
  );

-- Jobs
DROP POLICY IF EXISTS "Users can view jobs of their company" ON jobs;
CREATE POLICY "Users can view jobs of their company" ON jobs
  FOR SELECT USING (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can insert jobs for their company" ON jobs;
CREATE POLICY "Users can insert jobs for their company" ON jobs
  FOR INSERT WITH CHECK (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can update jobs for their company" ON jobs;
CREATE POLICY "Users can update jobs for their company" ON jobs
  FOR UPDATE USING (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can delete jobs for their company" ON jobs;
CREATE POLICY "Users can delete jobs for their company" ON jobs
  FOR DELETE USING (has_role_on_company(company_id));

-- Candidates
DROP POLICY IF EXISTS "Users can view candidates of their company" ON candidates;
CREATE POLICY "Users can view candidates of their company" ON candidates
  FOR SELECT USING (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can insert candidates for their company" ON candidates;
CREATE POLICY "Users can insert candidates for their company" ON candidates
  FOR INSERT WITH CHECK (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can update candidates for their company" ON candidates;
CREATE POLICY "Users can update candidates for their company" ON candidates
  FOR UPDATE USING (has_role_on_company(company_id));

-- Integrations
DROP POLICY IF EXISTS "Users can view integration configs for their company" ON integration_configs;
CREATE POLICY "Users can view integration configs for their company" ON integration_configs
  FOR SELECT USING (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can upsert integration configs for their company" ON integration_configs;
CREATE POLICY "Users can upsert integration configs for their company" ON integration_configs
  FOR ALL USING (has_role_on_company(company_id)) WITH CHECK (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can view webhook events of their company" ON webhook_events;
CREATE POLICY "Users can view webhook events of their company" ON webhook_events
  FOR SELECT USING (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can manage webhook events of their company" ON webhook_events;
CREATE POLICY "Users can manage webhook events of their company" ON webhook_events
  FOR ALL USING (has_role_on_company(company_id)) WITH CHECK (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can view email templates of their company" ON email_templates;
CREATE POLICY "Users can view email templates of their company" ON email_templates
  FOR SELECT USING (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can manage email templates of their company" ON email_templates;
CREATE POLICY "Users can manage email templates of their company" ON email_templates
  FOR ALL USING (has_role_on_company(company_id)) WITH CHECK (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can view email events of their company" ON email_events;
CREATE POLICY "Users can view email events of their company" ON email_events
  FOR SELECT USING (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can manage email events of their company" ON email_events;
CREATE POLICY "Users can manage email events of their company" ON email_events
  FOR ALL USING (has_role_on_company(company_id)) WITH CHECK (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can view scheduling configs for their company" ON scheduling_provider_configs;
CREATE POLICY "Users can view scheduling configs for their company" ON scheduling_provider_configs
  FOR SELECT USING (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can manage scheduling configs for their company" ON scheduling_provider_configs;
CREATE POLICY "Users can manage scheduling configs for their company" ON scheduling_provider_configs
  FOR ALL USING (has_role_on_company(company_id)) WITH CHECK (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can view scheduling tokens of their company" ON scheduling_tokens;
CREATE POLICY "Users can view scheduling tokens of their company" ON scheduling_tokens
  FOR SELECT USING (has_role_on_company(company_id));

DROP POLICY IF EXISTS "Users can manage scheduling tokens of their company" ON scheduling_tokens;
CREATE POLICY "Users can manage scheduling tokens of their company" ON scheduling_tokens
  FOR ALL USING (has_role_on_company(company_id)) WITH CHECK (has_role_on_company(company_id));
