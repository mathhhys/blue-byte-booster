-- Fix analytics RPCs to accept clerk_org_id and bypass RLS

-- Drop the old function that takes UUID
DROP FUNCTION IF EXISTS get_org_analytics(UUID, DATE, DATE);

-- 1. Update get_org_analytics to accept clerk_org_id
CREATE OR REPLACE FUNCTION get_org_analytics(
  p_clerk_org_id TEXT,
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
DECLARE
  v_org_id UUID;
BEGIN
  -- Handle case where a UUID might be passed directly (for backward compatibility)
  IF p_clerk_org_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_org_id := p_clerk_org_id::UUID;
  ELSE
    SELECT id INTO v_org_id FROM organizations WHERE clerk_org_id = p_clerk_org_id;
  END IF;
  
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH org_usage AS (
    SELECT
      COALESCE(SUM(dus.total_requests), 0) AS total_requests,
      COALESCE(SUM(dus.total_credits), 0) AS total_credits,
      COALESCE(SUM(dus.total_input_tokens), 0) AS total_input_tokens,
      COALESCE(SUM(dus.total_output_tokens), 0) AS total_output_tokens
    FROM daily_usage_summary dus
    WHERE dus.organization_id = v_org_id
      AND dus.usage_date >= p_start_date
      AND dus.usage_date <= p_end_date
  ),
  model_usage AS (
    SELECT
      m.model_id,
      COALESCE(SUM(m.total_usd_spent), 0) AS cost,
      COALESCE(SUM(m.total_requests), 0) AS requests
    FROM monthly_org_model_usage m
    WHERE m.organization_id = v_org_id
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

-- 2. Create get_org_users_analytics to fetch user analytics by clerk_org_id
CREATE OR REPLACE FUNCTION get_org_users_analytics(
  p_clerk_org_id TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  user_id TEXT,
  total_requests BIGINT,
  total_credits BIGINT,
  total_input_tokens BIGINT,
  total_output_tokens BIGINT,
  usage_date DATE
) AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Handle case where a UUID might be passed directly
  IF p_clerk_org_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_org_id := p_clerk_org_id::UUID;
  ELSE
    SELECT id INTO v_org_id FROM organizations WHERE clerk_org_id = p_clerk_org_id;
  END IF;
  
  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    dus.user_id,
    dus.total_requests::BIGINT,
    dus.total_credits::BIGINT,
    dus.total_input_tokens::BIGINT,
    dus.total_output_tokens::BIGINT,
    dus.usage_date
  FROM daily_usage_summary dus
  WHERE dus.organization_id = v_org_id
    AND dus.usage_date >= p_start_date
    AND dus.usage_date <= p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
