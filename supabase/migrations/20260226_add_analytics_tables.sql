-- Migration: Add Analytics Tables
-- Purpose: Create tables and functions for organization and user analytics

-- -------------------------------------------------------------------------------------
-- Drop existing materialized views if they exist (from previous schema)
-- -------------------------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS daily_usage_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS monthly_org_analytics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS monthly_seat_analytics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS monthly_org_model_usage CASCADE;

-- -------------------------------------------------------------------------------------
-- daily_usage_summary
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_usage_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Clerk user ID
  usage_date DATE NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_credits INTEGER NOT NULL DEFAULT 0,
  total_input_tokens INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_usage_summary_org_date ON daily_usage_summary(organization_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_daily_usage_summary_user ON daily_usage_summary(user_id);

-- -------------------------------------------------------------------------------------
-- monthly_org_analytics
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_org_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL, -- Format: YYYY-MM
  total_credits_used INTEGER NOT NULL DEFAULT 0,
  total_usd_spent NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_input_tokens INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,
  seat_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_org_analytics_org_month ON monthly_org_analytics(organization_id, year_month);

-- -------------------------------------------------------------------------------------
-- monthly_seat_analytics
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_seat_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Clerk user ID
  year_month TEXT NOT NULL, -- Format: YYYY-MM
  total_credits_used INTEGER NOT NULL DEFAULT 0,
  total_usd_spent NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_input_tokens INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_seat_analytics_org_month ON monthly_seat_analytics(organization_id, year_month);
CREATE INDEX IF NOT EXISTS idx_monthly_seat_analytics_user ON monthly_seat_analytics(user_id);

-- -------------------------------------------------------------------------------------
-- monthly_org_model_usage
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_org_model_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  year_month TEXT NOT NULL, -- Format: YYYY-MM
  total_credits_used INTEGER NOT NULL DEFAULT 0,
  total_usd_spent NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_input_tokens INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, model_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_org_model_usage_org_month ON monthly_org_model_usage(organization_id, year_month);

-- -------------------------------------------------------------------------------------
-- Triggers for updated_at
-- -------------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_daily_usage_summary_updated_at ON daily_usage_summary;
CREATE TRIGGER trigger_daily_usage_summary_updated_at
  BEFORE UPDATE ON daily_usage_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_monthly_org_analytics_updated_at ON monthly_org_analytics;
CREATE TRIGGER trigger_monthly_org_analytics_updated_at
  BEFORE UPDATE ON monthly_org_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_monthly_seat_analytics_updated_at ON monthly_seat_analytics;
CREATE TRIGGER trigger_monthly_seat_analytics_updated_at
  BEFORE UPDATE ON monthly_seat_analytics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_monthly_org_model_usage_updated_at ON monthly_org_model_usage;
CREATE TRIGGER trigger_monthly_org_model_usage_updated_at
  BEFORE UPDATE ON monthly_org_model_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------------------------------------
-- RPC: get_org_analytics
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_org_analytics(
  p_org_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_requests BIGINT,
  total_credits BIGINT,
  total_input_tokens BIGINT,
  total_output_tokens BIGINT,
  top_models JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH org_usage AS (
    SELECT
      COALESCE(SUM(dus.total_requests), 0) AS total_requests,
      COALESCE(SUM(dus.total_credits), 0) AS total_credits,
      COALESCE(SUM(dus.total_input_tokens), 0) AS total_input_tokens,
      COALESCE(SUM(dus.total_output_tokens), 0) AS total_output_tokens
    FROM daily_usage_summary dus
    WHERE dus.organization_id = p_org_id
      AND dus.usage_date >= p_start_date
      AND dus.usage_date <= p_end_date
  ),
  model_usage AS (
    -- We approximate model usage from monthly tables since we don't have daily model usage
    -- This is a limitation of the current schema, but we can use the monthly data that overlaps
    SELECT
      m.model_id,
      COALESCE(SUM(m.total_usd_spent), 0) AS cost,
      COALESCE(SUM(m.total_requests), 0) AS requests
    FROM monthly_org_model_usage m
    WHERE m.organization_id = p_org_id
      AND m.year_month >= to_char(p_start_date, 'YYYY-MM')
      AND m.year_month <= to_char(p_end_date, 'YYYY-MM')
    GROUP BY m.model_id
    ORDER BY requests DESC
    LIMIT 5
  )
  SELECT
    ou.total_requests::BIGINT,
    ou.total_credits::BIGINT,
    ou.total_input_tokens::BIGINT,
    ou.total_output_tokens::BIGINT,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'model_id', mu.model_id,
          'cost', mu.cost,
          'requests', mu.requests
        )
      ) FROM model_usage mu),
      '[]'::jsonb
    ) AS top_models
  FROM org_usage ou;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -------------------------------------------------------------------------------------
-- RLS Policies
-- -------------------------------------------------------------------------------------
ALTER TABLE daily_usage_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_org_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_seat_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_org_model_usage ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_daily_usage_summary') THEN
    CREATE POLICY "service_role_all_daily_usage_summary" ON daily_usage_summary FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_monthly_org_analytics') THEN
    CREATE POLICY "service_role_all_monthly_org_analytics" ON monthly_org_analytics FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_monthly_seat_analytics') THEN
    CREATE POLICY "service_role_all_monthly_seat_analytics" ON monthly_seat_analytics FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_monthly_org_model_usage') THEN
    CREATE POLICY "service_role_all_monthly_org_model_usage" ON monthly_org_model_usage FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;