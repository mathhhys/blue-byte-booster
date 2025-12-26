import { createClerkClient } from '@clerk/backend';
import { orgAdminMiddleware } from '../../src/utils/clerk/token-verification.js';
import { organizationSeatOperations } from '../../src/utils/supabase/database.js';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

let cachedClerkClient: ReturnType<typeof createClerkClient> | null = null;

function getClerkClient() {
  if (!cachedClerkClient) {
    const key = process.env.CLERK_SECRET_KEY;
    console.log('🔍 DEBUG: Clerk Secret Key present:', !!key);
    if (key) {
      console.log('🔍 DEBUG: Clerk Secret Key prefix:', key.substring(0, 8) + '...');
    }
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

// Helper function to calculate credits based on plan and billing frequency
function calculateCreditsToGrant(planType: string, billingFrequency: string, seats: number = 1) {
  const baseCredits = billingFrequency === 'yearly' ? 6000 : 500;
  return baseCredits * seats;
}

async function syncSubscriptionFromStripe(clerkOrgId: string) {
  console.log('🔄 Syncing subscription from Stripe for org (invite):', clerkOrgId);

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
      console.log('⚠️ Organization not found in Supabase, cannot link subscription yet.');
      // We continue, but organization_id will be null/missing in upsert if we don't have it.
      // Ideally we should have it because we call syncOrganizationFromClerk before this.
    }

    const customers = await stripe.customers.search({
      query: `metadata['clerk_org_id']:'${clerkOrgId}'`,
      limit: 1
    });

    if (customers.data.length === 0) {
      console.log('❌ No Stripe customer found for org:', clerkOrgId);
      return false;
    }

    const customer = customers.data[0];

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
      return false;
    }

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
    
    // Calculate credits
    const totalCredits = calculateCreditsToGrant(planType, billingFrequency, seatsTotal);

    const subscriptionData: any = {
      clerk_org_id: clerkOrgId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customer.id,
      plan_type: planType,
      billing_frequency: billingFrequency,
      seats_total: seatsTotal,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      // Initialize credits if creating new record
      total_credits: totalCredits,
      // used_credits: 0 // Default is 0 in DB
    };

    if (org) {
      subscriptionData.organization_id = org.id;
    }

    const { error } = await supabase
      .from('organization_subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'clerk_org_id'
      });

    if (error) {
      console.error('❌ Error upserting organization subscription:', error);
      return false;
    }

    console.log('✅ Organization subscription synced successfully (invite)');
    return true;
  } catch (error) {
    console.error('❌ Error syncing subscription (invite):', error);
    return false;
  }
}

async function syncOrganizationFromClerk(clerkOrgId: string) {
  console.log('🔄 Syncing organization from Clerk (invite):', clerkOrgId);
  try {
    const clerk = getClerkClient();
    const supabase = getSupabaseAdminClient();

    const org = await clerk.organizations.getOrganization({ organizationId: clerkOrgId });
    
    const { error } = await supabase.rpc('upsert_organization', {
      p_clerk_org_id: org.id,
      p_name: org.name
    });

    if (error) {
      console.error('❌ Error upserting organization:', error);
      return false;
    }

    console.log('✅ Organization synced successfully from Clerk');
    return true;
  } catch (error) {
    console.error('❌ Error syncing organization from Clerk:', error);
    return false;
  }
}

export default async function handler(req: any, res: any) {
  console.log('🟢 INVITE API ROUTE HIT');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orgId, email, role } = req.body;

    if (!orgId || !email) {
      return res.status(400).json({ error: 'Organization ID and email are required' });
    }

    // Authenticate org admin
    console.log('🔍 Calling orgAdminMiddleware for org:', orgId);
    const authResult = await orgAdminMiddleware(req, orgId);
    console.log('✅ Middleware passed for user:', authResult.userId, 'in org:', orgId);

    // 1. Reserve seat in Supabase BEFORE calling Clerk
    // This ensures immediate seat reduction and handles availability checks.
    console.log(`🔍 Reserving seat for ${email} in org ${orgId}`);
    
    const seatResult = await organizationSeatOperations.assignSeat(orgId, email, role === 'admin' ? 'admin' : 'member');
    
    if (seatResult.error) {
      console.log('❌ Seat reservation failed:', seatResult.error);
      
      if (seatResult.error === 'No available seats. Please upgrade your plan.') {
        return res.status(402).json({ error: 'Insufficient seats' });
      }
      
      if (seatResult.error === 'User already has a reserved or active seat in this organization') {
        // If seat already exists, we can still try to create the Clerk invitation (idempotency)
        console.log('⚠️ Seat already reserved, proceeding to Clerk invitation...');
      } else if (seatResult.error === 'Organization subscription not found') {
        console.log('⚠️ Subscription not found, attempting sync...');
        await syncOrganizationFromClerk(orgId);
        await syncSubscriptionFromStripe(orgId);
        
        // Retry reservation
        const retryResult = await organizationSeatOperations.assignSeat(orgId, email, role === 'admin' ? 'admin' : 'member');
        if (retryResult.error) {
          return res.status(retryResult.error === 'No available seats. Please upgrade your plan.' ? 402 : 404).json({ error: retryResult.error });
        }
      } else {
        return res.status(500).json({ error: 'Database error', details: seatResult.error });
      }
    }

    // 2. Create invitation using Clerk Backend SDK
    console.log(`🔍 Creating Clerk invitation for ${email} in org ${orgId}`);
    console.log(`🔍 Using role: ${role || 'member'} (requested: ${role})`);
    console.log(`🔍 Inviter User ID: ${authResult.userId}`);
    
    try {
      const invitation = await getClerkClient().organizations.createOrganizationInvitation({
        organizationId: orgId,
        emailAddress: email,
        role: role === 'admin' ? 'admin' : 'basic_member',
      });

      console.log('✅ Clerk invitation created:', invitation.id);

      return res.status(200).json({
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.emailAddress,
          role: invitation.role,
          status: invitation.status,
          created_at: invitation.createdAt,
        }
      });
    } catch (clerkError: any) {
      console.error('❌ Error creating Clerk invitation. Full error:', JSON.stringify(clerkError, null, 2));
      console.error('❌ Clerk Error Status:', clerkError.status);
      console.error('❌ Clerk Error Message:', clerkError.message);
      
      // ROLLBACK: Release the reserved seat if Clerk fails
      console.log(`🔄 Rolling back seat reservation for ${email} in org ${orgId}`);
      await organizationSeatOperations.releaseSeatByEmail(orgId, email, 'invite_failed');
      
      // Handle specific Clerk errors
      if (clerkError.errors && clerkError.errors.length > 0) {
        const error = clerkError.errors[0];
        if (error.code === 'form_identifier_exists') {
          return res.status(400).json({ error: 'User is already a member or has a pending invitation in Clerk' });
        }
        return res.status(400).json({
          error: error.message || 'Failed to create invitation',
          clerkError: clerkError
        });
      }
      
      return res.status(400).json({
        error: clerkError.message || 'Failed to create invitation',
        clerkError: clerkError
      });
    }

  } catch (error: any) {
    console.error('❌ Error creating invitation:', error);
    
    if (error.message?.includes('Missing or invalid Authorization header')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (error.message?.includes('User does not belong to this organization') || error.message?.includes('User is not an organization admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Handle Clerk errors
    if (error.errors && error.errors.length > 0) {
      const clerkError = error.errors[0];
      return res.status(400).json({ error: clerkError.message || 'Failed to create invitation' });
    }

    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}