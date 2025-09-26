import { useState, useEffect } from 'react';
import { useOrganization } from '@clerk/nextjs';
import { createClient } from '@/utils/supabase/client';
import { useToast } from './use-toast';

export function useOrganizationSeats() {
  const { organization } = useOrganization();
  const [seats, setSeats] = useState<any[]>([]);
  const [usages, setUsages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const supabase = createClient();

  useEffect(() => {
    if (!organization?.id) return;

    const fetchSeats = async () => {
      setLoading(true);
      try {
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('id')
          .eq('clerk_org_id', organization.id)
          .single();

        if (orgError) throw orgError;
        if (!org) throw new Error('Organization not found');

        const { data: s, error: sError } = await supabase
          .from('organization_seats')
          .select('*')
          .eq('clerk_org_id', organization.id)
          .eq('status', 'active');

        if (sError) throw sError;
        setSeats(s || []);

        const { data: u, error: uError } = await supabase
          .from('license_usages')
          .select('*')
          .eq('organization_id', org.id)
          .gte('period_start', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days approx

        if (uError) throw uError;
        setUsages(u || []);
      } catch (err: any) {
        setError(err.message);
        toast({ title: 'Error', description: 'Failed to load seats', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchSeats();

    // Poll every 30s for real-time updates
    const interval = setInterval(fetchSeats, 30000);
    return () => clearInterval(interval);
  }, [organization?.id, toast]);

  const assignSeat = async (userEmail: string, userName?: string, expiresAt?: string) => {
    try {
      const res = await fetch('/api/organization/seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkUserId: null, userEmail, userName, expiresAt }), // clerkUserId set on acceptance via webhook
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Failed to assign seat');
      }

      // Refresh
      const { data: org } = await supabase.from('organizations').select('id').eq('clerk_org_id', organization.id).single();
      const { data: s } = await supabase.from('organization_seats').select('*').eq('clerk_org_id', organization.id).eq('status', 'active');
      setSeats(s || []);

      toast({ title: 'Success', description: 'Seat assigned' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const revokeSeat = async (clerkUserId: string) => {
    try {
      const res = await fetch(`/api/organization/seats?clerkUserId=${clerkUserId}`, { method: 'DELETE' });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || 'Failed to revoke seat');
      }

      // Refresh
      const { data: org } = await supabase.from('organizations').select('id').eq('clerk_org_id', organization.id).single();
      const { data: s } = await supabase.from('organization_seats').select('*').eq('clerk_org_id', organization.id).eq('status', 'active');
      setSeats(s || []);

      toast({ title: 'Success', description: 'Seat revoked' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const isValidSeat = seats.length > 0 && !error;

  return { seats, usages, loading, error, assignSeat, revokeSeat, isValidSeat };
}