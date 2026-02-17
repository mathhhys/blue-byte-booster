// Vercel serverless function for buying additional seats
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  console.log('=== BUY SEATS API ROUTE ENTRY ===');

  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { orgId, clerkUserId, quantity = 1, successUrl, cancelUrl } = req.body;

    // Validate input
    if (!orgId || !clerkUserId || !quantity || quantity < 1) {
      return res.status(400).json({ error: 'Missing required parameters or invalid quantity' });
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

    // Get the appropriate price ID for additional seats (teams plan)
    const billingFrequency = orgSubscription.billing_frequency;
    const priceIds = {
      monthly: {
        USD: 'price_1RwN7VH6gWxKcaTXHVkwwT60',
        EUR: 'price_1RwN6oH6gWxKcaTXgmKllDYt',
        GBP: 'price_1RwN7uH6gWxKcaTX0jJCR7uU'
      },
      yearly: {
        USD: 'price_1RwN8hH6gWxKcaTXEaGbVvhz',
        EUR: 'price_1RwN8QH6gWxKcaTX7thDBBm7',
        GBP: 'price_1RwN9FH6gWxKcaTXQBUURC9T'
      }
    };

    // Assume USD for now, can be extended for multi-currency
    const priceId = priceIds[billingFrequency]?.USD;
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid billing frequency' });
    }

    // Create checkout session for additional seats
    const session = await stripe.checkout.sessions.create({
      customer: orgSubscription.stripe_customer_id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: quantity,
          adjustable_quantity: {
            enabled: true,
            minimum: 1,
            maximum: 100,
          },
        },
      ],
      mode: 'payment', // One-time payment for additional seats
      success_url: successUrl || `${req.headers.origin || 'https://www.softcodes.ai'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.origin || 'https://www.softcodes.ai'}/payment-cancelled`,
      metadata: {
        clerk_user_id: clerkUserId,
        org_id: orgId,
        type: 'additional_seats',
        quantity: quantity.toString(),
        billing_frequency: billingFrequency,
      },
      allow_promotion_codes: true,
    });

    return res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('Error in buy-seats:', error);
    return res.status(500).json({
      error: 'Failed to create checkout session',
      details: error.message,
    });
  }
}