// Vercel serverless function for creating Kinde organization subscriptions
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { kindeAuthMiddleware } from '../../../middleware/dual-auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  console.log('=== KINDE SUBSCRIBE API ROUTE ENTRY ===');

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate Kinde authentication
    const authResult = await kindeAuthMiddleware(req, res, null);
    if (!authResult) return; // Response already sent by middleware

    const { orgCode } = req.query;
    const { seats, billingFrequency, successUrl, cancelUrl } = req.body;

    // Validate that user belongs to this organization
    if (req.auth.orgCode !== orgCode) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    // Validate input
    if (!seats || seats < 3 || seats > 100) {
      return res.status(400).json({ error: 'Seats must be between 3 and 100' });
    }

    if (!['monthly', 'yearly'].includes(billingFrequency)) {
      return res.status(400).json({ error: 'Invalid billing frequency' });
    }

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if organization already has a subscription
    const { data: existingSub } = await supabase
      .from('kinde_organization_subscriptions')
      .select('*')
      .eq('kinde_org_code', orgCode)
      .eq('status', 'active')
      .single();

    if (existingSub) {
      return res.status(400).json({ 
        error: 'Organization already has an active subscription',
        redirect_url: '/dashboard'
      });
    }

    // Get the appropriate price ID based on billing frequency
    // Teams plan pricing: €30/seat/month or €288/seat/year (20% discount)
    const priceIds = {
      monthly: {
        EUR: process.env.STRIPE_TEAMS_MONTHLY_EUR || 'price_teams_monthly_eur',
        USD: process.env.STRIPE_TEAMS_MONTHLY_USD || 'price_teams_monthly_usd',
      },
      yearly: {
        EUR: process.env.STRIPE_TEAMS_YEARLY_EUR || 'price_teams_yearly_eur',
        USD: process.env.STRIPE_TEAMS_YEARLY_USD || 'price_teams_yearly_usd',
      },
    };

    // Default to EUR for now
    const priceId = priceIds[billingFrequency]?.EUR;
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid pricing configuration' });
    }

    // Create or retrieve Stripe customer
    let stripeCustomerId;
    
    // Check if we already have a customer for this org
    const { data: existingCustomer } = await supabase
      .from('kinde_organization_customers')
      .select('stripe_customer_id')
      .eq('kinde_org_code', orgCode)
      .single();

    if (existingCustomer?.stripe_customer_id) {
      stripeCustomerId = existingCustomer.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: req.auth.email,
        metadata: {
          kinde_org_code: orgCode,
          kinde_org_name: req.auth.orgName || 'Unknown',
          kinde_user_id: req.auth.userId,
          provider: 'kinde',
        },
      });
      stripeCustomerId = customer.id;

      // Store customer mapping
      await supabase
        .from('kinde_organization_customers')
        .insert({
          kinde_org_code: orgCode,
          kinde_org_name: req.auth.orgName,
          stripe_customer_id: stripeCustomerId,
          created_by_user_id: req.auth.userId,
          created_at: new Date().toISOString(),
        });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: seats,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${req.headers.origin || 'https://www.softcodes.ai'}/dashboard?subscription=success`,
      cancel_url: cancelUrl || `${req.headers.origin || 'https://www.softcodes.ai'}/teams/subscribe`,
      subscription_data: {
        metadata: {
          kinde_org_code: orgCode,
          kinde_org_name: req.auth.orgName || 'Unknown',
          kinde_user_id: req.auth.userId,
          provider: 'kinde',
          seats_total: seats.toString(),
          billing_frequency: billingFrequency,
        },
      },
      metadata: {
        kinde_org_code: orgCode,
        provider: 'kinde',
        type: 'org_subscription',
      },
      allow_promotion_codes: true,
    });

    return res.status(200).json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
    });

  } catch (error) {
    console.error('Error in Kinde subscribe:', error);
    return res.status(500).json({
      error: 'Failed to create subscription',
      details: error.message,
    });
  }
}