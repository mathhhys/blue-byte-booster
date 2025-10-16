import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getOrCreateStripeCustomer(clerkUserId: string): Promise<string> {
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('clerk_id', clerkUserId)
    .single();

  if (userError) {
    console.error('Error fetching user from Supabase:', userError);
    throw new Error('Failed to fetch user data');
  }

  if (userData?.stripe_customer_id) {
    return userData.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    metadata: {
      clerkUserId: clerkUserId,
    },
  });

  const { error: updateError } = await supabase
    .from('users')
    .update({ stripe_customer_id: customer.id })
    .eq('clerk_id', clerkUserId);

  if (updateError) {
    console.error('Error updating user in Supabase:', updateError);
    throw new Error('Failed to update user data with Stripe customer ID');
  }

  return customer.id;
}

export async function POST(request: Request) {
  try {
    const { clerkUserId, billingFrequency, skipTrial = false } = await request.json();

    if (!clerkUserId) {
      return new Response(JSON.stringify({ error: 'clerkUserId is required' }), { status: 400 });
    }

    if (!['monthly', 'yearly'].includes(billingFrequency)) {
      return new Response(JSON.stringify({ error: 'Invalid billing frequency' }), { status: 400 });
    }

    const customerId = await getOrCreateStripeCustomer(clerkUserId);

    // Get price ID for Pro plan (assume env vars are set for monthly and yearly)
    const priceId = billingFrequency === 'monthly' 
      ? process.env.STRIPE_PRO_MONTHLY_PRICE_ID!
      : process.env.STRIPE_PRO_YEARLY_PRICE_ID!;

    const trialPeriodDays = skipTrial ? 0 : 7;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: trialPeriodDays,
        metadata: {
          clerkUserId,
          skipTrial: skipTrial.toString(),
          plan_type: 'pro',
        },
      },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/cancelled`,
    });

    if (!session.url) {
      return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), { status: 500 });
    }

    return new Response(JSON.stringify({ url: session.url }), { status: 200 });
  } catch (error) {
    console.error('Error creating Pro subscription checkout:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
}