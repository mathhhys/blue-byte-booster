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

    const { quantity, billingFrequency, orgId, clerkUserId, successUrl, cancelUrl } = req.body;

    // Validate input
    if (!quantity || !billingFrequency || !orgId || !clerkUserId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (quantity < 1 || quantity > 100) {
      return res.status(400).json({ error: 'Quantity must be between 1 and 100' });
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

    // Get or create Stripe customer
    let customer;
    const customers = await stripe.customers.list({ limit: 100 });
    customer = customers.data.find((c) => c.metadata?.clerk_user_id === clerkUserId);

    if (!customer) {
      // Fetch user email
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('clerk_id', clerkUserId)
        .single();

      customer = await stripe.customers.create({
        email: userData?.email,
        metadata: { clerk_user_id: clerkUserId },
      });
    }

    // Create checkout session
    const priceId = SEAT_PRICING[billingFrequency].priceId;

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: quantity,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${req.headers.origin || 'https://www.softcodes.ai'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.origin || 'https://www.softcodes.ai'}/payment-cancelled`,
      metadata: {
        clerk_user_id: clerkUserId,
        org_id: orgId,
        additional_seats: quantity.toString(),
        billing_frequency: billingFrequency,
      },
      subscription_data: {
        metadata: {
          clerk_user_id: clerkUserId,
          org_id: orgId,
          additional_seats: quantity.toString(),
          billing_frequency: billingFrequency,
        },
      },
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