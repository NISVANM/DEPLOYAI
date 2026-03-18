-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- Helper function to check membership
CREATE OR REPLACE FUNCTION has_role_on_company(company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM company_memberships cm
    WHERE cm.company_id = has_role_on_company.company_id
      AND cm.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Companies Policies
CREATE POLICY "Users can view companies they are members of" ON companies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = companies.id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert companies" ON companies
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Company Memberships Policies
CREATE POLICY "Users can view memberships of their companies" ON company_memberships
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id AND cm.user_id = auth.uid()
    )
  );

-- Jobs Policies
CREATE POLICY "Users can view jobs of their company" ON jobs
  FOR SELECT USING (
    has_role_on_company(company_id)
  );

CREATE POLICY "Users can insert jobs for their company" ON jobs
  FOR INSERT WITH CHECK (
    has_role_on_company(company_id)
  );

CREATE POLICY "Users can update jobs for their company" ON jobs
  FOR UPDATE USING (
    has_role_on_company(company_id)
  );

-- Candidates Policies
CREATE POLICY "Users can view candidates of their company" ON candidates
  FOR SELECT USING (
    has_role_on_company(company_id)
  );

CREATE POLICY "Users can insert candidates for their company" ON candidates
  FOR INSERT WITH CHECK (
    has_role_on_company(company_id)
  );

CREATE POLICY "Users can update candidates for their company" ON candidates
  FOR UPDATE USING (
    has_role_on_company(company_id)
  );
