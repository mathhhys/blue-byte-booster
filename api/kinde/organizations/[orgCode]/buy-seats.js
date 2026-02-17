// Vercel serverless function for buying additional seats for Kinde organizations
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { kindeAuthMiddleware } from '../../../middleware/dual-auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  console.log('=== KINDE BUY SEATS API ROUTE ENTRY ===');

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate Kinde authentication
    const authResult = await kindeAuthMiddleware(req, res, null);
    if (!authResult) return;

    const { orgCode } = req.query;
    const { quantity = 1, successUrl, cancelUrl } = req.body;

    // Validate that user belongs to this organization
    if (req.auth.orgCode !== orgCode) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    // Check if user has admin role
    const isAdmin = req.auth.roles?.includes('admin') || req.auth.roles?.includes('org:admin');
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can purchase seats' });
    }

    // Validate quantity
    if (!quantity || quantity < 1 || quantity > 100) {
      return res.status(400).json({ error: 'Quantity must be between 1 and 100' });
    }

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from('kinde_organization_subscriptions')
      .select('*, kinde_organization_customers!inner(stripe_customer_id)')
      .eq('kinde_org_code', orgCode)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const stripeCustomerId = subscription.kinde_organization_customers?.stripe_customer_id;
    if (!stripeCustomerId) {
      return res.status(400).json({ error: 'No Stripe customer found for this organization' });
    }

    // Get the appropriate price ID based on billing frequency
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

    const priceId = priceIds[subscription.billing_frequency]?.EUR;
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid pricing configuration' });
    }

    // Option 1: Update existing subscription (proration)
    if (subscription.stripe_subscription_id) {
      // Get the subscription from Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      
      // Find the subscription item
      const subscriptionItem = stripeSubscription.items.data[0];
      
      if (subscriptionItem) {
        // Update quantity directly (with proration)
        const updatedSubscription = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          items: [{
            id: subscriptionItem.id,
            quantity: subscription.seats_total + quantity,
          }],
          proration_behavior: 'create_prorations',
          metadata: {
            seats_total: (subscription.seats_total + quantity).toString(),
          },
        });

        // Update database
        await supabase
          .from('kinde_organization_subscriptions')
          .update({ 
            seats_total: subscription.seats_total + quantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);

        return res.status(200).json({
          success: true,
          message: `Added ${quantity} seat(s) to your subscription`,
          seats_total: subscription.seats_total + quantity,
          proration: true,
        });
      }
    }

    // Option 2: Create a checkout session for additional seats
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: quantity,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${req.headers.origin || 'https://www.softcodes.ai'}/dashboard?seats_added=true`,
      cancel_url: cancelUrl || `${req.headers.origin || 'https://www.softcodes.ai'}/dashboard`,
      subscription_data: {
        metadata: {
          kinde_org_code: orgCode,
          type: 'additional_seats',
          additional_seats: quantity.toString(),
        },
      },
      metadata: {
        kinde_org_code: orgCode,
        provider: 'kinde',
        type: 'additional_seats',
        quantity: quantity.toString(),
      },
      allow_promotion_codes: true,
    });

    return res.status(200).json({
      success: true,
      url: session.url,
      session_id: session.id,
    });

  } catch (error) {
    console.error('Error in Kinde buy seats:', error);
    return res.status(500).json({
      error: 'Failed to purchase seats',
      details: error.message,
    });
  }
}