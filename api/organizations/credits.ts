import { createClient } from '@supabase/supabase-js';
import { orgMemberMiddleware } from '../../src/utils/clerk/token-verification.js';

type OrgCreditsResponse = {
  total_credits: number;
  used_credits: number;
  remaining_credits: number;
  has_active_seat: boolean;
  seat_id: string;
  seat_role: string | null;
  clerk_org_id: string;

  organization_id: string | null; // Supabase UUID
  organization_name: string | null;
  stripe_customer_id: string | null;
  organization_subscription_id: string | null;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { org_id } = req.query;

  if (!org_id) {
    return res.status(400).json({ error: 'Organization ID is required' });
  }

  try {
    // Any org member may call this endpoint, but pooled credits are only visible to users
    // who hold an active seat in the organization.
    const auth = await orgMemberMiddleware(req, org_id);

    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Seat-gating: only seat holders can view the org pooled balance
    const { data: seat, error: seatError } = await supabase
      .from('organization_seats')
      .select('id, role, organization_subscription_id')
      .eq('clerk_org_id', org_id)
      .eq('clerk_user_id', auth.userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (seatError) {
      console.error('Error fetching active seat:', seatError);
      return res.status(500).json({ error: 'Failed to fetch seat' });
    }

    if (!seat) {
      return res.status(403).json({ error: 'No active seat in this organization' });
    }

    // Fetch org + subscription info (for analytics + UI)
    const [{ data: organization }, { data: subscription, error: subError }] = await Promise.all([
      supabase
        .from('organizations')
        .select('id, name, stripe_customer_id')
        .eq('clerk_org_id', org_id)
        .maybeSingle(),
      supabase
        .from('organization_subscriptions')
        .select('id, organization_id, total_credits, used_credits')
        .eq('id', seat.organization_subscription_id)
        .in('status', ['active', 'trialing'])
        .maybeSingle()
    ]);

    if (subError) {
      console.error('Error fetching organization subscription credits:', subError);
      return res.status(500).json({ error: 'Failed to fetch credits' });
    }

    const total = subscription?.total_credits || 0;
    const used = subscription?.used_credits || 0;
    const remaining = Math.max(0, total - used);

    const payload: OrgCreditsResponse = {
      total_credits: total,
      used_credits: used,
      remaining_credits: remaining,
      has_active_seat: true,
      seat_id: seat.id,
      seat_role: seat.role || null,
      clerk_org_id: org_id,

      organization_id: organization?.id || subscription?.organization_id || null,
      organization_name: organization?.name || null,
      stripe_customer_id: organization?.stripe_customer_id || null,
      organization_subscription_id: subscription?.id || seat.organization_subscription_id || null
    };

    return res.status(200).json(payload);
  } catch (error: any) {
    console.error('Error in credits API:', error);
    if (error.message?.includes('Missing or invalid Authorization header')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (error.message?.includes('User does not belong to this organization')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}