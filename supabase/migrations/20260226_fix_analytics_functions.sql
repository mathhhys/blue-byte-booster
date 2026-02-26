-- Migration: Fix analytics RPC functions
-- Purpose: Eliminate all conflicting/duplicate overloads of get_org_analytics and get_user_analytics,
--          then recreate both with the exact parameter names the frontend passes:
--            p_org_id TEXT (clerk_org_id), p_start_date DATE, p_end_date DATE
-- Root cause: PGRST203 from multiple overloads (UUID + TEXT variants), PGRST202 from wrong
--             parameter names (p_clerk_org_id, p_user_id) vs what the frontend sends (p_org_id).

-- -------------------------------------------------------------------------------------
-- Drop ALL overloads of get_org_analytics (handles UUID, TEXT, and any other variants)
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid, pg_get_function_identity_arguments(oid) AS args
    FROM pg_proc
    WHERE proname = 'get_org_analytics'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.get_org_analytics(%s) CASCADE', r.args);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------------------
-- Drop ALL overloads of get_user_analytics (handles any existing variants)
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid, pg_get_function_identity_arguments(oid) AS args
    FROM pg_proc
    WHERE proname = 'get_user_analytics'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.get_user_analytics(%s) CASCADE', r.args);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------------------
-- Drop ALL overloads of get_org_users_analytics (superseded by get_user_analytics)
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid, pg_get_function_identity_arguments(oid) AS args
    FROM pg_proc
    WHERE proname = 'get_org_users_analytics'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.get_org_users_analytics(%s) CASCADE', r.args);
  END LOOP;
END $$;

-- -------------------------------------------------------------------------------------
-- get_org_analytics(p_org_id TEXT, p_start_date DATE, p_end_date DATE)
-- Accepts clerk_org_id (e.g. 'org_3A7hsarspLC7csfoTQGz8d18oZX') as p_org_id.
-- Internally resolves to the organizations.id UUID via clerk_org_id lookup.
-- Returns empty row set gracefully if the org is not found.
-- -------------------------------------------------------------------------------------
CREATE FUNCTION public.get_org_analytics(
  p_org_id      TEXT,
  p_start_date  DATE,
  p_end_date    DATE
)
RETURNS TABLE (
  total_requests       BIGINT,
  total_credits        BIGINT,
  total_input_tokens   BIGINT,
  total_output_tokens  BIGINT,
  top_models           JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_uuid UUID;
BEGIN
  -- Resolve clerk_org_id -> internal UUID
  SELECT id INTO v_org_uuid
  FROM organizations
  WHERE clerk_org_id = p_org_id
  LIMIT 1;

  -- Org not found: return empty result set (no exception)
  IF v_org_uuid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH org_usage AS (
    SELECT
      COALESCE(SUM(dus.total_requests), 0)     AS total_requests,
      COALESCE(SUM(dus.total_credits), 0)      AS total_credits,
      COALESCE(SUM(dus.total_input_tokens), 0) AS total_input_tokens,
      COALESCE(SUM(dus.total_output_tokens), 0)AS total_output_tokens
    FROM daily_usage_summary dus
    WHERE dus.organization_id = v_org_uuid
      AND dus.usage_date BETWEEN p_start_date AND p_end_date
  ),
  model_usage AS (
    SELECT
      m.model_id,
      COALESCE(SUM(m.total_usd_spent), 0)  AS cost,
      COALESCE(SUM(m.total_requests), 0)   AS requests
    FROM monthly_org_model_usage m
    WHERE m.organization_id = v_org_uuid
      AND m.year_month BETWEEN to_char(p_start_date, 'YYYY-MM')
                           AND to_char(p_end_date,   'YYYY-MM')
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
                  'cost',     mu.cost,
                  'requests', mu.requests
                )
              )
       FROM model_usage mu),
      '[]'::jsonb
    ) AS top_models
  FROM org_usage ou;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_analytics(TEXT, DATE, DATE) TO anon, authenticated, service_role;

-- -------------------------------------------------------------------------------------
-- get_user_analytics(p_org_id TEXT, p_start_date DATE, p_end_date DATE)
-- Accepts clerk_org_id as p_org_id — matches exactly what the frontend passes.
-- Returns one row per (user_id, usage_date) so the frontend can aggregate.
-- Returns empty row set gracefully if the org is not found.
-- -------------------------------------------------------------------------------------
CREATE FUNCTION public.get_user_analytics(
  p_org_id      TEXT,
  p_start_date  DATE,
  p_end_date    DATE
)
RETURNS TABLE (
  user_id              TEXT,
  usage_date           DATE,
  total_requests       BIGINT,
  total_credits        BIGINT,
  total_input_tokens   BIGINT,
  total_output_tokens  BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_uuid UUID;
BEGIN
  -- Resolve clerk_org_id -> internal UUID
  SELECT id INTO v_org_uuid
  FROM organizations
  WHERE clerk_org_id = p_org_id
  LIMIT 1;

  -- Org not found: return empty result set (no exception)
  IF v_org_uuid IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    dus.user_id,
    dus.usage_date,
    dus.total_requests::BIGINT,
    dus.total_credits::BIGINT,
    dus.total_input_tokens::BIGINT,
    dus.total_output_tokens::BIGINT
  FROM daily_usage_summary dus
  WHERE dus.organization_id = v_org_uuid
    AND dus.usage_date BETWEEN p_start_date AND p_end_date
  ORDER BY dus.usage_date DESC, dus.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_analytics(TEXT, DATE, DATE) TO anon, authenticated, service_role;