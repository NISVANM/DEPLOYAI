-- 1. Create ENUMs
CREATE TYPE candidate_status AS ENUM ('new', 'screening', 'interviewed', 'offered', 'rejected');
CREATE TYPE role AS ENUM ('owner', 'admin', 'member');

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

-- 3. Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

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

-- 5. RLS Policies

-- Companies
CREATE POLICY "Users can view companies they are members of" ON companies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = companies.id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert companies" ON companies
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Company Memberships
CREATE POLICY "Users can view memberships of their companies" ON company_memberships
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id AND cm.user_id = auth.uid()
    )
  );
  
CREATE POLICY "Owners can manage memberships" ON company_memberships
  FOR ALL USING (
    EXISTS (
        SELECT 1 FROM companies c
        WHERE c.id = company_memberships.company_id AND c.owner_id = auth.uid()
    )
  );

-- Jobs
CREATE POLICY "Users can view jobs of their company" ON jobs
  FOR SELECT USING (has_role_on_company(company_id));

CREATE POLICY "Users can insert jobs for their company" ON jobs
  FOR INSERT WITH CHECK (has_role_on_company(company_id));

CREATE POLICY "Users can update jobs for their company" ON jobs
  FOR UPDATE USING (has_role_on_company(company_id));
  
CREATE POLICY "Users can delete jobs for their company" ON jobs
  FOR DELETE USING (has_role_on_company(company_id));

-- Candidates
CREATE POLICY "Users can view candidates of their company" ON candidates
  FOR SELECT USING (has_role_on_company(company_id));

CREATE POLICY "Users can insert candidates for their company" ON candidates
  FOR INSERT WITH CHECK (has_role_on_company(company_id));

CREATE POLICY "Users can update candidates for their company" ON candidates
  FOR UPDATE USING (has_role_on_company(company_id));
