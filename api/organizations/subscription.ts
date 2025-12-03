import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { organizationSeatOperations } from '../../src/utils/supabase/database.js';
import { orgAdminMiddleware } from '../../src/utils/clerk/token-verification.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId, org_id } = req.query;
  
  console.log('🔍 DEBUG: Subscription endpoint - Received query parameters:', req.query);
  console.log('🔍 DEBUG: orgId param:', orgId);
  console.log('🔍 DEBUG: org_id param:', org_id);
  
  const finalOrgId = orgId || org_id;

  if (!finalOrgId) {
    console.log('❌ DEBUG: No organization ID found in query parameters');
    return res.status(400).json({ error: 'Organization ID is required (orgId or org_id)' });
  }
  
  console.log('✅ DEBUG: Getting subscription for organization ID:', finalOrgId);

  try {
    // Verify organization admin access
    const authResult = await orgAdminMiddleware(req, finalOrgId as string);
    console.log('🔍 API: Getting subscription for organization:', finalOrgId, 'by user:', authResult.userId);

    try {
      // Find Stripe customer for the organization
      const customers = await stripe.customers.list({ limit: 100 });
      const customer = customers.data.find(c => c.metadata?.clerk_org_id === finalOrgId);
  
      if (!customer) {
        console.log('No Stripe customer found for org:', finalOrgId);
        return res.status(200).json({ hasSubscription: false, subscription: null });
      }
  
      // Get the organization's subscription from Stripe
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 1
      });
  
      if (subscriptions.data.length === 0) {
        console.log('No subscription found for customer:', customer.id);
        return res.status(200).json({ hasSubscription: false, subscription: null });
      }
  
      const subscription = subscriptions.data[0];
      const price = await stripe.prices.retrieve(subscription.items.data[0].price.id);
  
      // Get seats_total from quantity
      const seats_total = subscription.items.data[0]?.quantity || 1;
  
      // Get plan_type from price metadata or lookup
      const plan_type = subscription.metadata.plan_type || 'teams';
  
      // Get billing_frequency from price recurrence
      const billing_frequency = price.recurring.interval === 'month' ? 'monthly' : 'yearly';
  
      const subscriptionInfo = {
        id: subscription.id,
        status: subscription.status,
        trial_end: (subscription as any).trial_end ? (subscription as any).trial_end * 1000 : null, // Convert to ms for ISO
        trial_start: (subscription as any).trial_start ? (subscription as any).trial_start * 1000 : null,
        seats_total,
        plan_type,
        billing_frequency,
        stripe_customer_id: customer.id,
        current_period_end: (subscription as any).current_period_end ? (subscription as any).current_period_end * 1000 : null,
      };
  
      // Optionally store/update in Supabase if needed
      // For now, just return Stripe data
  
      console.log('✅ API: Subscription data:', subscriptionInfo);
      return res.status(200).json({
        hasSubscription: true,
        subscription: subscriptionInfo
      });
    } catch (stripeError) {
      console.error('Error fetching Stripe subscription:', stripeError);
      return res.status(500).json({ error: 'Failed to fetch subscription' });
    }
  } catch (error: any) {
    console.error('❌ API: Exception in subscription endpoint:', error);
    
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