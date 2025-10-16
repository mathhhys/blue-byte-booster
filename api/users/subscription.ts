import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400 });
    }

    // Get user from supabase
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id, subscription_anniversary_date, plan_type')
      .eq('clerk_id', userId)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    let subscription = null;

    if (user.stripe_customer_id) {
      // Get active subscriptions from Stripe
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0] as Stripe.Subscription;
        subscription = {
          id: sub.id,
          status: sub.status,
          trial_end: sub.trial_end,
          current_period_end: (sub as any).current_period_end ?? null,
          trial_start: sub.trial_start,
          plan_type: sub.metadata.planType || user.plan_type,
          billing_frequency: sub.items.data[0]?.price.recurring.interval,
        } as {
          id: string;
          status: string;
          trial_end: number | null;
          current_period_end: number | null;
          trial_start: number | null;
          plan_type: string;
          billing_frequency: string;
        };
      }
    }

    return new Response(JSON.stringify({
      hasSubscription: subscription != null,
      subscription,
      anniversary_date: user.subscription_anniversary_date,
      plan_type: user.plan_type,
    }), { status: 200 });
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
}