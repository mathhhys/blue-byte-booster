import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { getAuth } from '@clerk/nextjs/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export default async (req: VercelRequest, res: VercelResponse) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { orgId } = req.query;

  if (!orgId || typeof orgId !== 'string') {
    return res.status(400).json({ error: 'Organization ID is required' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // In production, you would:
    // 1. Query your database to find the Stripe customer ID for this organization
    // 2. Find the active subscription for this customer
    // 3. Get the subscription details including seat count

    // For development, let's simulate looking up subscription data
    const customers = await stripe.customers.search({
      query: `metadata['clerk_org_id']:'${orgId}'`,
    });

    if (customers.data.length === 0) {
      // No subscription found
      return res.status(200).json({
        hasSubscription: false,
        subscription: null,
      });
    }

    const customer = customers.data[0];
    
    // Get active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return res.status(200).json({
        hasSubscription: false,
        subscription: null,
      });
    }

    const subscription = subscriptions.data[0];
    
    // Extract seat count from subscription items
    const subscriptionItem = subscription.items.data[0];
    const seatCount = subscriptionItem.quantity || 1;

    return res.status(200).json({
      hasSubscription: true,
      subscription: {
        id: subscription.id,
        customer_id: customer.id,
        seats_total: seatCount,
        plan_type: 'teams',
        status: subscription.status,
        billing_frequency: subscription.items.data[0].price.recurring?.interval || 'month',
        current_period_start: new Date((subscription as any).current_period_start * 1000),
        current_period_end: new Date((subscription as any).current_period_end * 1000),
        created_at: new Date(subscription.created * 1000),
      },
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return res.status(500).json({ error: 'Failed to fetch subscription data' });
  }
};