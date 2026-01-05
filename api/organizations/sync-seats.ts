import { createClerkClient } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';

let cachedClerkClient: ReturnType<typeof createClerkClient> | null = null;

function getClerkClient() {
  if (!cachedClerkClient) {
    const key = process.env.CLERK_SECRET_KEY;
    if (!key) {
      throw new Error('CLERK_SECRET_KEY is not configured');
    }
    cachedClerkClient = createClerkClient({
      secretKey: key
    });
  }
  return cachedClerkClient;
}

function getSupabaseAdminClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL) is not configured');
  }
  if (!supabaseKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * API endpoint to synchronize organization_seats table with Clerk data
 * This ensures the database stays in sync with Clerk as the single source of truth
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { organizationId } = req.body;

    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    const clerk = getClerkClient();
    const supabase = getSupabaseAdminClient();

    // Fetch organization data from Clerk
    let organization;
    try {
      organization = await clerk.organizations.getOrganization({
        organizationId,
      });
    } catch (clerkError: any) {
      console.error('Error fetching organization from Clerk:', clerkError);
      return res.status(404).json({
        error: 'Organization not found',
        details: clerkError?.message
      });
    }

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Get member count from Clerk
    let members;
    try {
      members = await clerk.organizations.getOrganizationMembershipList({
        organizationId,
      });
    } catch (memberError: any) {
      console.error('Error fetching members from Clerk:', memberError);
      return res.status(500).json({
        error: 'Failed to fetch members',
        details: memberError?.message
      });
    }
    const memberCount = members.totalCount;

    // Get pending invitations count from Clerk
    let invitations;
    try {
      invitations = await clerk.organizations.getOrganizationInvitationList({
        organizationId,
        status: ['pending'],
      });
    } catch (inviteError: any) {
      console.error('Error fetching invitations from Clerk:', inviteError);
      return res.status(500).json({
        error: 'Failed to fetch invitations',
        details: inviteError?.message
      });
    }
    const pendingInvitationsCount = invitations.totalCount;

    // Calculate seats used
    const seatsUsed = memberCount + pendingInvitationsCount;

    // Get seats total from subscription (Stripe)
    const { data: subscription, error: subError } = await supabase
      .from('organization_subscriptions')
      .select('quantity')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      console.error('Error fetching subscription:', subError);
      return res.status(404).json({
        error: 'Active subscription not found',
        details: subError?.message
      });
    }

    const seatsTotal = subscription.quantity;

    // Update organization_seats table
    const { error: updateError } = await supabase
      .from('organization_seats')
      .upsert({
        organization_id: organizationId,
        seats_used: seatsUsed,
        seats_total: seatsTotal,
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      console.error('Error syncing seats:', updateError);
      return res.status(500).json({
        error: 'Failed to sync seats',
        details: updateError?.message
      });
    }

    // Update organization members count
    const { error: orgUpdateError } = await supabase
      .from('organizations')
      .update({
        members_count: memberCount,
        invitations_count: pendingInvitationsCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organizationId);

    if (orgUpdateError) {
      console.error('Error updating organization counts:', orgUpdateError);
      // Don't fail the request if this update fails, but log it
      // This is a non-critical update for consistency
    }

    return res.status(200).json({
      success: true,
      data: {
        organizationId,
        seatsUsed,
        seatsTotal,
        memberCount,
        pendingInvitationsCount,
      },
    });
  } catch (error: any) {
    console.error('Unexpected error in sync-seats:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error?.message
    });
  }
}