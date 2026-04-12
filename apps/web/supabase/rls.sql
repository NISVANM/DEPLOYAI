-- Optional: if you already ran `schema.sql` in full, you do not need this file.
-- If you use this file alone, run `schema.sql` first (tables + enums).

-- Enable RLS on all tables
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

-- Helper function to check membership
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

-- Companies Policies
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

-- Company Memberships Policies
DROP POLICY IF EXISTS "Users can view memberships of their companies" ON company_memberships;
CREATE POLICY "Users can view memberships of their companies" ON company_memberships
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM company_memberships cm
      WHERE cm.company_id = company_memberships.company_id AND cm.user_id = auth.uid()
    )
  );

-- Jobs Policies
DROP POLICY IF EXISTS "Users can view jobs of their company" ON jobs;
CREATE POLICY "Users can view jobs of their company" ON jobs
  FOR SELECT USING (
    has_role_on_company(company_id)
  );

DROP POLICY IF EXISTS "Users can insert jobs for their company" ON jobs;
CREATE POLICY "Users can insert jobs for their company" ON jobs
  FOR INSERT WITH CHECK (
    has_role_on_company(company_id)
  );

DROP POLICY IF EXISTS "Users can update jobs for their company" ON jobs;
CREATE POLICY "Users can update jobs for their company" ON jobs
  FOR UPDATE USING (
    has_role_on_company(company_id)
  );

-- Candidates Policies
DROP POLICY IF EXISTS "Users can view candidates of their company" ON candidates;
CREATE POLICY "Users can view candidates of their company" ON candidates
  FOR SELECT USING (
    has_role_on_company(company_id)
  );

DROP POLICY IF EXISTS "Users can insert candidates for their company" ON candidates;
CREATE POLICY "Users can insert candidates for their company" ON candidates
  FOR INSERT WITH CHECK (
    has_role_on_company(company_id)
  );

DROP POLICY IF EXISTS "Users can update candidates for their company" ON candidates;
CREATE POLICY "Users can update candidates for their company" ON candidates
  FOR UPDATE USING (
    has_role_on_company(company_id)
  );

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
