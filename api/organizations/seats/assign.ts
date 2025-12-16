import { organizationSeatOperations } from '../../../src/utils/supabase/database.js';
import { orgAdminMiddleware } from '../../../src/utils/clerk/token-verification.js';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

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

async function syncSubscriptionFromStripe(clerkOrgId: string) {
  console.log('🔄 Syncing subscription from Stripe for org:', clerkOrgId);

  try {
    const stripe = getStripeClient();
    const supabase = getSupabaseAdminClient();

    // 1. Find Stripe Customer by metadata
    const customers = await stripe.customers.search({
      query: `metadata['clerk_org_id']:'${clerkOrgId}'`,
      limit: 1
    });

    if (customers.data.length === 0) {
      console.log('❌ No Stripe customer found for org:', clerkOrgId);
      return false;
    }

    const customer = customers.data[0];
    console.log('✅ Found Stripe customer:', customer.id);

    // 2. Get subscriptions (active OR trialing)
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

    console.log('✅ Found subscription:', subscription.id, 'status:', subscription.status);

    // 3. Calculate seats
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

    // 4. Create/Update organization_subscriptions record
    // IMPORTANT: do NOT reset seats_used on upsert (existing orgs may already have seats assigned)
    const { error } = await supabase
      .from('organization_subscriptions')
      .upsert({
        clerk_org_id: clerkOrgId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customer.id,
        plan_type: planType,
        billing_frequency: billingFrequency,
        seats_total: seatsTotal,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'clerk_org_id'
      });

    if (error) {
      console.error('❌ Error creating organization subscription:', error);
      return false;
    }

    console.log('✅ Organization subscription synced successfully');
    return true;

  } catch (error) {
    console.error('❌ Error syncing subscription:', error);
    return false;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId, org_id, userEmail, email, role } = req.body;
  
  console.log('🔍 DEBUG: Assign endpoint - Received body:', req.body);
  
  const finalOrgId = orgId || org_id;
  const finalEmail = userEmail || email;

  if (!finalOrgId || !finalEmail) {
    console.log('❌ DEBUG: Missing parameters - orgId/org_id:', finalOrgId, 'userEmail/email:', finalEmail);
    return res.status(400).json({ error: 'Organization ID and user email are required' });
  }
  
  console.log('✅ DEBUG: Using orgId:', finalOrgId, 'email:', finalEmail);

  try {
    // Verify organization admin access
    const authResult = await orgAdminMiddleware(req, finalOrgId);
    console.log('🔍 API: Assigning seat for organization:', finalOrgId, 'by user:', authResult.userId, 'to email:', finalEmail);

    let result = await organizationSeatOperations.assignSeat(finalOrgId, finalEmail, role || 'member');

    // If subscription not found, try to sync from Stripe and retry
    if (result.error === 'Organization subscription not found') {
      console.log('⚠️ Subscription not found, attempting to sync from Stripe...');
      const synced = await syncSubscriptionFromStripe(finalOrgId);
      
      if (synced) {
        console.log('🔄 Retry assigning seat after sync...');
        result = await organizationSeatOperations.assignSeat(finalOrgId, finalEmail, role || 'member');
      } else {
        console.log('❌ Sync failed or no subscription found in Stripe');
      }
    }

    const { data, error } = result;

    if (error) {
      console.error('❌ API: Database error:', error);
      
      if (error === 'No available seats. Please upgrade your plan.') {
        return res.status(402).json({ 
          error: 'Insufficient seats',
          message: 'No available seats. Please upgrade your plan to add more seats.'
        });
      }
      
      if (
        error === 'User already has a reserved or active seat in this organization' ||
        error === 'User already has an active seat in this organization'
      ) {
        return res.status(400).json({ error: 'User already has a reserved or active seat' });
      }
      
      if (error === 'Organization subscription not found') {
         return res.status(404).json({
           error: 'Subscription not found',
           message: 'No active or trialing subscription found for this organization. Please ensure you have purchased a plan.'
         });
       }

      return res.status(500).json({ error: 'Database error', details: error });
    }

    console.log('✅ API: Seat assigned successfully');
    return res.status(201).json({ 
      data, 
      error: null,
      message: 'Seat assigned successfully'
    });
  } catch (error: any) {
    console.error('❌ API: Exception:', error);
    
    if (error.message === 'Missing or invalid Authorization header') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (error.message === 'User does not belong to this organization' || 
        error.message === 'User is not an organization admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}