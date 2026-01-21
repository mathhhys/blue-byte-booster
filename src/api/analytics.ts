import { supabase } from '@/utils/supabase/client';
import { OrgAnalytics, UserAnalytics } from '@/types/analytics';

export async function getOrgAnalytics(orgId: string, startDate: string, endDate: string): Promise<OrgAnalytics | null> {
  const { data, error } = await supabase.rpc('get_org_analytics', {
    p_org_id: orgId,
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
  // We'll use the daily_usage_summary table to aggregate user data
  // Note: This assumes daily_usage_summary is populated. If not, we might need to query api_request_logs directly
  // but that would be heavier. The plan suggests using daily_usage_summary or raw logs.
  // Let's try to use a custom query on daily_usage_summary first as it's more efficient.
  
  const { data, error } = await supabase
    .from('daily_usage_summary')
    .select('user_id, total_requests, total_credits, total_input_tokens, total_output_tokens, usage_date')
    .eq('organization_id', orgId)
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