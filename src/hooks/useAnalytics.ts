import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase/client';
import {
  MonthlyOrgAnalytics, 
  MonthlySeatAnalytics, 
  MonthlyOrgModelUsage 
} from '../types/analytics';

export function useAnalytics(organizationId: string, yearMonth: string) {
  const [orgAnalytics, setOrgAnalytics] = useState<MonthlyOrgAnalytics | null>(null);
  const [seatAnalytics, setSeatAnalytics] = useState<MonthlySeatAnalytics[]>([]);
  const [modelUsage, setModelUsage] = useState<MonthlyOrgModelUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      if (!organizationId || !yearMonth) return;
      
      setIsLoading(true);
      setError(null);

      try {
        // 1. Fetch Org Overview
        const { data: orgData, error: orgError } = await supabase
          .from('monthly_org_analytics')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('year_month', yearMonth)
          .single();

        if (orgError && orgError.code !== 'PGRST116') throw orgError;
        setOrgAnalytics(orgData);

        // 2. Fetch Seat Usage (with user details)
        const { data: seatData, error: seatError } = await supabase
          .from('monthly_seat_analytics')
          .select(`
            *,
            users (
              clerk_id
            )
          `)
          .eq('organization_id', organizationId)
          .eq('year_month', yearMonth)
          .order('total_credits_used', { ascending: false });

        if (seatError) throw seatError;
        setSeatAnalytics(seatData as any);

        // 3. Fetch Model Usage
        const { data: modelData, error: modelError } = await supabase
          .from('monthly_org_model_usage')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('year_month', yearMonth)
          .order('total_credits_used', { ascending: false });

        if (modelError) throw modelError;
        setModelUsage(modelData);

      } catch (err: any) {
        console.error('Error fetching analytics:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [organizationId, yearMonth]);

  return { orgAnalytics, seatAnalytics, modelUsage, isLoading, error };
}