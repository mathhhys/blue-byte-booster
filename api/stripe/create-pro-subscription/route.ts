import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clerkUserId, currency = 'eur', skipTrial = false, billingFrequency = 'monthly' } = body;

    if (!clerkUserId) {
      return new Response(JSON.stringify({ error: 'clerkUserId is required' }), { status: 400 });
    }

    // Get or create Stripe customer
    const { data: user } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('clerk_id', clerkUserId)
      .single();

    let customerId = user?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { clerkUserId },
      });
      customerId = customer.id;

      await supabase
        .from('users')
        .update({ stripe_customer_id: customer.id })
        .eq('clerk_id', clerkUserId);
    }

    // Get Pro price ID for currency and frequency
    const priceId = getProPriceId(currency, billingFrequency);

    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Invalid currency or billing frequency' }), { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const subscriptionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment-cancelled`,
      metadata: {
        clerkUserId,
        plan: 'pro',
        currency,
        billingFrequency,
        skipTrial: skipTrial.toString(),
      },
    };

    // Add trial if not skipping
    if (!skipTrial) {
      subscriptionParams.subscription_data = {
        trial_period_days: 7,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
        },
      };
    }

    const session = await stripe.checkout.sessions.create(subscriptionParams);

    return new Response(JSON.stringify({ url: session.url }), { status: 200 });

  } catch (error) {
    console.error('Error creating Pro subscription:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}

function getProPriceId(currency: string, billingFrequency: string): string | null {
  const prices: Record<string, Record<string, string>> = {
    eur: {
      monthly: 'price_1RvK8KH6gWxKcaTXO4AlW0MQ',
      yearly: 'price_1RvK8LH6gWxKcaTXqqNXiuus',
    },
    usd: {
      monthly: 'price_1RvK8KH6gWxKcaTXCWyv035N',
      yearly: 'price_1RvK8KH6gWxKcaTXEn1S0Lql',
    },
    gbp: {
      monthly: 'price_1RvK8KH6gWxKcaTXQvGGVCNI',
      yearly: 'price_1RvK8KH6gWxKcaTXYTeJ18no',
    },
  };

  return prices[currency]?.[billingFrequency] || null;
}