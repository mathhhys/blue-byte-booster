import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { getAuth } from '@clerk/nextjs/server';
import { getOrCreateStripeCustomer } from '../../utils/stripe/server.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { clerk_org_id, plan_type, billing_frequency, seats_total, priceId } = req.body;

    if (!clerk_org_id || !priceId || !seats_total) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create or get Stripe customer for organization
    const customer = await stripe.customers.create({
      metadata: {
        clerk_org_id: clerk_org_id,
        clerk_user_id: userId,
        subscription_type: 'organization',
      },
    });

    // Create checkout session with the real price ID
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId, // Use the real Stripe price ID
          quantity: seats_total,
        },
      ],
      metadata: {
        clerk_org_id: clerk_org_id,
        clerk_user_id: userId,
        plan_type: plan_type,
        billing_frequency: billing_frequency,
        seats_total: seats_total.toString(),
        subscription_type: 'organization',
      },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/organizations?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/organizations?billing=cancelled`,
    });

    return res.status(200).json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (error) {
    console.error('Error creating organization subscription:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to create organization subscription' 
    });
  }
};