import { createClerkClient } from '@clerk/backend';
import { orgAdminMiddleware } from '../../src/utils/clerk/token-verification.js';
import Stripe from 'stripe';
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

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(key);
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

async function syncOrganizationFromClerk(clerkOrgId: string) {
  console.log('🔄 Syncing organization from Clerk:', clerkOrgId);
  try {
    const clerk = getClerkClient();
    const supabase = getSupabaseAdminClient();

    let org;
    try {
      org = await clerk.organizations.getOrganization({ organizationId: clerkOrgId });
    } catch (clerkError: any) {
      console.error(`❌ Clerk API error fetching org ${clerkOrgId}:`, JSON.stringify(clerkError, null, 2));
      return { success: false, error: `Clerk organization not found: ${clerkOrgId}` };
    }
    
    // Fetch actual member count from Clerk
    let membersCount = 0;
    try {
      const memberships = await clerk.organizations.getOrganizationMembershipList({
        organizationId: clerkOrgId,
        limit: 1 // We only need totalCount
      });
      membersCount = memberships.totalCount || 0;
      console.log(`📊 Fetched members count from Clerk: ${membersCount}`);
    } catch (memberError) {
      console.error('Error fetching members count:', memberError);
      // Continue with 0 if fetch fails
    }

    // Fetch actual pending invitation count from Clerk
    let pendingInvitationsCount = 0;
    try {
      const invitations = await clerk.organizations.getOrganizationInvitationList({
        organizationId: clerkOrgId,
        status: ['pending'], // Only count pending invitations
        limit: 1 // We only need totalCount
      });
      pendingInvitationsCount = invitations.totalCount || 0;
      console.log(`📊 Fetched pending invitations count from Clerk: ${pendingInvitationsCount}`);
    } catch (inviteError) {
      console.error('Error fetching invitations count:', inviteError);
      // Continue with 0 if fetch fails
    }
    
    const { error } = await supabase.rpc('upsert_organization', {
      p_clerk_org_id: org.id,
      p_name: org.name,
      p_members_count: membersCount,
      p_pending_invitations_count: pendingInvitationsCount
    });

    if (error) {
      console.error('❌ Error upserting organization:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Organization synced successfully from Clerk with counts:', {
      members: membersCount,
      invitations: pendingInvitationsCount
    });
    return {
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        membersCount,
        pendingInvitationsCount
      }
    };
  } catch (error: any) {
    console.error('❌ Error syncing organization from Clerk:', error);
    return { success: false, error: error.message };
  }
}

async function syncSubscriptionFromStripe(clerkOrgId: string) {
  console.log('🔄 Syncing subscription from Stripe for org:', clerkOrgId);

  try {
    const stripe = getStripeClient();
    const supabase = getSupabaseAdminClient();

    // 1. Get Organization ID from Supabase
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('clerk_org_id', clerkOrgId)
      .single();

    if (orgError || !org) {
      console.log('⚠️ Organization not found in Supabase');
      return { success: false, error: 'Organization not found in database' };
    }

    // 2. Search for Stripe customer with this clerk_org_id
    const customers = await stripe.customers.search({
      query: `metadata['clerk_org_id']:'${clerkOrgId}'`,
      limit: 1
    });

    if (customers.data.length === 0) {
      console.log('❌ No Stripe customer found for org:', clerkOrgId);
      return { success: false, error: 'No Stripe customer found for this organization' };
    }

    const customer = customers.data[0];

    // 3. Get active subscription for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10,
      expand: ['data.items']
    });

    const subscription: any = subscriptions.data.find(
      (s: any) => s.status === 'active' || s.status === 'trialing'
    );

    if (!subscription) {
      console.log('❌ No active/trialing subscription found for customer:', customer.id);
      return { success: false, error: 'No active subscription found' };
    }

    // 4. Extract subscription details
    const metadata = subscription.metadata || {};
    let seatsTotal = 1;

    if (metadata.seats_total) {
      seatsTotal = parseInt(metadata.seats_total, 10);
    } else if (metadata.seats) {
      seatsTotal = parseInt(metadata.seats, 10);
    } else {
      seatsTotal = subscription.items.data.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
    }

    if (!Number.isFinite(seatsTotal) || seatsTotal < 1) {
      seatsTotal = 1;
    }

    const planType = metadata.plan_type || 'teams';
    const billingFrequency = metadata.billing_frequency || 'monthly';
    
    // Calculate credits (500 per seat for monthly, 6000 for yearly)
    const baseCredits = billingFrequency === 'yearly' ? 6000 : 500;
    const totalCredits = baseCredits * seatsTotal;

    // 5. Upsert subscription data
    const subscriptionData: any = {
      clerk_org_id: clerkOrgId,
      organization_id: org.id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customer.id,
      plan_type: planType,
      billing_frequency: billingFrequency,
      seats_total: seatsTotal,
      seats_used: 0, // Will be calculated from organization_seats table
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      total_credits: totalCredits,
      used_credits: 0,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('organization_subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'clerk_org_id'
      });

    if (error) {
      console.error('❌ Error upserting organization subscription:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Organization subscription synced successfully');
    return { 
      success: true, 
      subscription: {
        id: subscription.id,
        seats_total: seatsTotal,
        plan_type: planType,
        billing_frequency: billingFrequency,
        total_credits: totalCredits
      }
    };
  } catch (error: any) {
    console.error('❌ Error syncing subscription:', error);
    return { success: false, error: error.message };
  }
}

export default async function handler(req: any, res: any) {
  console.log('🟢 SYNC SUBSCRIPTION API ROUTE HIT');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orgId } = req.body;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Authenticate org admin
    console.log('🔍 Calling orgAdminMiddleware for org:', orgId);
    const authResult = await orgAdminMiddleware(req, orgId);
    console.log('✅ Middleware passed for user:', authResult.userId, 'in org:', orgId);

    // 1. Sync organization from Clerk
    console.log('📋 Step 1: Syncing organization from Clerk...');
    const orgResult = await syncOrganizationFromClerk(orgId);
    
    if (!orgResult.success) {
      return res.status(500).json({
        error: 'Failed to sync organization',
        details: orgResult.error,
        step: 'organization_sync'
      });
    }

    // 2. Sync subscription from Stripe
    console.log('💳 Step 2: Syncing subscription from Stripe...');
    const subResult = await syncSubscriptionFromStripe(orgId);

    if (!subResult.success) {
      return res.status(500).json({
        error: 'Failed to sync subscription',
        details: subResult.error,
        step: 'subscription_sync',
        organization: orgResult.organization
      });
    }

    console.log('✅ Sync completed successfully');
    return res.status(200).json({
      success: true,
      message: 'Organization and subscription synced successfully',
      organization: orgResult.organization,
      subscription: subResult.subscription
    });

  } catch (error: any) {
    console.error('❌ Error in sync-subscription:', error);
    
    if (error.message?.includes('Missing or invalid Authorization header')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (error.message?.includes('User does not belong to this organization') || error.message?.includes('User is not an organization admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}