// Vercel serverless function for getting Kinde organization subscription
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { kindeAuthMiddleware } from '../../../middleware/dual-auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  console.log('=== KINDE SUBSCRIPTION API ROUTE ENTRY ===');

  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate Kinde authentication
    const authResult = await kindeAuthMiddleware(req, res, null);
    if (!authResult) return;

    const { orgCode } = req.query;

    // Validate that user belongs to this organization
    if (req.auth.orgCode !== orgCode) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get subscription from database
    const { data: subscription, error: subError } = await supabase
      .from('kinde_organization_subscriptions')
      .select('*')
      .eq('kinde_org_code', orgCode)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !subscription) {
      return res.status(404).json({ 
        hasSubscription: false,
        error: 'No active subscription found' 
      });
    }

    // Get seat usage
    const { data: seats, error: seatsError } = await supabase
      .from('kinde_organization_seats')
      .select('*')
      .eq('kinde_org_code', orgCode)
      .eq('status', 'active');

    const seatsUsed = seats?.length || 0;

    // Optionally sync with Stripe for latest data
    let stripeSubscription = null;
    if (subscription.stripe_subscription_id) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      } catch (stripeError) {
        console.warn('Could not fetch Stripe subscription:', stripeError.message);
      }
    }

    return res.status(200).json({
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        stripe_subscription_id: subscription.stripe_subscription_id,
        plan_type: subscription.plan_type,
        status: subscription.status,
        seats_total: subscription.seats_total,
        seats_used: seatsUsed,
        billing_frequency: subscription.billing_frequency,
        current_period_start: stripeSubscription?.current_period_start 
          ? new Date(stripeSubscription.current_period_start * 1000).toISOString()
          : subscription.current_period_start,
        current_period_end: stripeSubscription?.current_period_end 
          ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
          : subscription.current_period_end,
        created_at: subscription.created_at,
      },
    });

  } catch (error) {
    console.error('Error in Kinde subscription get:', error);
    return res.status(500).json({
      error: 'Failed to get subscription',
      details: error.message,
    });
  }
}