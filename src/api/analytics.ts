import { supabase } from '@/utils/supabase/client';
import { OrgAnalytics, UserAnalytics } from '@/types/analytics';

export async function getOrgAnalytics(orgId: string, startDate: string, endDate: string): Promise<OrgAnalytics | null> {
  // DEBUG: Log incoming parameters
  console.log('[Analytics Debug] getOrgAnalytics called with:', { orgId, startDate, endDate });
  
  // Pass clerk_org_id directly to RPC function - it handles the lookup internally
  // and returns empty results gracefully if organization doesn't exist
  const { data, error } = await supabase.rpc('get_org_analytics', {
    p_clerk_org_id: orgId,
    p_start_date: startDate,
    p_end_date: endDate
  });

  if (error) {
    console.error('Error fetching org analytics:', error);
    throw error;
  }

  // Return null if no data or empty result (organization not found or no usage)
  if (!data || data.length === 0) {
    console.log('[Analytics Debug] No analytics data found for org:', orgId);
    return null;
  }

  return data[0];
}

export async function getOrgUsersAnalytics(orgId: string, startDate: string, endDate: string): Promise<UserAnalytics[]> {
  // DEBUG: Log incoming parameters
  console.log('[Analytics Debug] getOrgUsersAnalytics called with:', { orgId, startDate, endDate });
  
  // Use the RPC function that accepts clerk_org_id directly
  const { data, error } = await supabase.rpc('get_org_users_analytics', {
    p_clerk_org_id: orgId,
    p_start_date: startDate,
    p_end_date: endDate
  });

  if (error) {
    console.error('Error fetching org users analytics:', error);
    throw error;
  }

  // If no data, return empty array (organization not found or no usage)
  if (!data || data.length === 0) {
    console.log('[Analytics Debug] No user analytics data found for org:', orgId);
    return [];
  }

  // Aggregate data by user
  const userMap = new Map<string, UserAnalytics>();

  data.forEach((record: any) => {
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
    userStats.total_requests += Number(record.total_requests) || 0;
    userStats.total_credits += Number(record.total_credits) || 0;
    userStats.total_input_tokens += Number(record.total_input_tokens) || 0;
    userStats.total_output_tokens += Number(record.total_output_tokens) || 0;
    
    if (new Date(record.usage_date) > new Date(userStats.last_active)) {
      userStats.last_active = record.usage_date;
    }
  });

  return Array.from(userMap.values()).sort((a, b) => b.total_credits - a.total_credits);
}