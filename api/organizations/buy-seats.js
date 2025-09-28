// Vercel serverless function for buying additional seats
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Pricing for additional seats (teams plan)
const SEAT_PRICING = {
  monthly: {
    priceId: 'price_1Qexample_monthly', // Replace with actual Stripe price ID for $10/seat/month
    amount: 1000, // $10.00 in cents
  },
  yearly: {
    priceId: 'price_1Qexample_yearly', // Replace with actual Stripe price ID for $96/seat/year
    amount: 9600, // $96.00 in cents
  },
};

export default async function handler(req, res) {
  console.log('=== BUY SEATS API ROUTE ENTRY ===');

  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { orgId, clerkUserId, successUrl, cancelUrl } = req.body;

    // Validate input
    if (!orgId || !clerkUserId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the organization's active subscription
    const { data: orgSubscription, error: subError } = await supabase
      .from('organization_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, plan_type, billing_frequency')
      .eq('clerk_org_id', orgId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !orgSubscription) {
      return res.status(404).json({ error: 'No active organization subscription found' });
    }

    if (!orgSubscription.stripe_customer_id) {
      return res.status(400).json({ error: 'Organization subscription missing Stripe customer ID' });
    }

    // Create customer portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: orgSubscription.stripe_customer_id,
      return_url: successUrl || `${req.headers.origin || 'https://www.softcodes.ai'}/teams`,
      configuration: {
        features: {
          subscription_update: {
            enabled: true,
            proration_behavior: 'create_prorations',
            default_allowed_updates: ['quantity']
          }
        }
      }
    });

    return res.status(200).json({
      url: portalSession.url,
    });

  } catch (error) {
    console.error('Error in buy-seats:', error);
    return res.status(500).json({
      error: 'Failed to create checkout session',
      details: error.message,
    });
  }
}