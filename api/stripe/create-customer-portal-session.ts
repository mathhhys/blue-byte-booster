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
    const customerId = await getOrCreateStripeCustomer(userId);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.FRONTEND_URL}/dashboard?billing=success`, // Redirect back to dashboard
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    return res.status(500).json({ error: 'Failed to create customer portal session' });
  }
};