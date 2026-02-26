import { supabase } from '@/utils/supabase/client';
import { OrgAnalytics, UserAnalytics } from '@/types/analytics';

// Helper to convert Clerk org ID to Supabase UUID
async function getSupabaseOrgId(clerkOrgId: string): Promise<string | null> {
  // DEBUG: Log the Clerk org ID being passed
  console.log('[Analytics Debug] Clerk org ID received:', clerkOrgId);
  console.log('[Analytics Debug] Is valid UUID format?', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clerkOrgId));
  
  // Check if it's already a valid UUID (not a Clerk ID)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clerkOrgId)) {
    console.log('[Analytics Debug] Already a UUID, using directly');
    return clerkOrgId;
  }
  
  // Look up the Supabase organization ID from clerk_org_id
  const { data: orgData, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', clerkOrgId)
    .maybeSingle();
    
  if (orgError) {
    console.error('[Analytics Debug] Error looking up org:', orgError);
    return null;
  }
  
  if (!orgData) {
    console.error('[Analytics Debug] No organization found for clerk_org_id:', clerkOrgId);
    return null;
  }
  
  console.log('[Analytics Debug] Converted to Supabase org UUID:', orgData.id);
  return orgData.id;
}

export async function getOrgAnalytics(orgId: string, startDate: string, endDate: string): Promise<OrgAnalytics | null> {
  // DEBUG: Log incoming parameters
  console.log('[Analytics Debug] getOrgAnalytics called with:', { orgId, startDate, endDate });
  
  // Convert Clerk org ID to Supabase UUID
  const supabaseOrgId = await getSupabaseOrgId(orgId);
  if (!supabaseOrgId) {
    const error = new Error(`Could not find Supabase organization for Clerk ID: ${orgId}`);
    console.error('[Analytics Debug] Failed to convert org ID:', error.message);
    throw error;
  }
  
  const { data, error } = await supabase.rpc('get_org_analytics', {
    p_org_id: supabaseOrgId,
    p_start_date: startDate,
    p_end_date: endDate
  });

  if (error) {
    console.error('Error fetching org analytics:', error);
    throw error;
  }

  return data && data.length > 0 ? data[0] : null;
}

export async function getOrgUsersAnalytics(orgId: string, startDate: string, endDate: string): Promise<UserAnalytics[]> {
  // DEBUG: Log incoming parameters
  console.log('[Analytics Debug] getOrgUsersAnalytics called with:', { orgId, startDate, endDate });
  
  // Convert Clerk org ID to Supabase UUID
  const supabaseOrgId = await getSupabaseOrgId(orgId);
  if (!supabaseOrgId) {
    const error = new Error(`Could not find Supabase organization for Clerk ID: ${orgId}`);
    console.error('[Analytics Debug] Failed to convert org ID:', error.message);
    throw error;
  }
  
  // We'll use the daily_usage_summary table to aggregate user data
  // Note: This assumes daily_usage_summary is populated. If not, we might need to query api_request_logs directly
  // but that would be heavier. The plan suggests using daily_usage_summary or raw logs.
  // Let's try to use a custom query on daily_usage_summary first as it's more efficient.
  
  const { data, error } = await supabase
    .from('daily_usage_summary')
    .select('user_id, total_requests, total_credits, total_input_tokens, total_output_tokens, usage_date')
    .eq('organization_id', supabaseOrgId)
    .gte('usage_date', startDate)
    .lte('usage_date', endDate);

  if (error) {
    console.error('Error fetching org users analytics:', error);
    throw error;
  }

  // Aggregate data by user
  const userMap = new Map<string, UserAnalytics>();

  data?.forEach((record: any) => {
    const userId = record.user_id;
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        user_id: userId,
        total_requests: 0,
        total_credits: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        last_active: record.usage_date
      });
    }

    const userStats = userMap.get(userId)!;
    userStats.total_requests += record.total_requests || 0;
    userStats.total_credits += record.total_credits || 0;
    userStats.total_input_tokens += record.total_input_tokens || 0;
    userStats.total_output_tokens += record.total_output_tokens || 0;
    
    if (new Date(record.usage_date) > new Date(userStats.last_active)) {
      userStats.last_active = record.usage_date;
    }
  });

  return Array.from(userMap.values()).sort((a, b) => b.total_credits - a.total_credits);
}