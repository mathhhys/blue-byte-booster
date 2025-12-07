import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { orgAdminMiddleware } from '../../src/utils/clerk/token-verification.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

export default async function handler(req: any, res: any) {
  console.log('🟢 BILLING PORTAL ROUTE HIT');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    const { clerk_org_id: orgId } = body;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID (clerk_org_id) is required' });
    }

    // Authenticate org admin
    console.log('🔍 Calling orgAdminMiddleware for org:', orgId);
    // Pass req directly as it has headers
    const authResult = await orgAdminMiddleware(req, orgId);
    console.log('✅ Middleware passed for user:', authResult.userId, 'in org:', orgId);
    console.log('🔍 API: Creating billing portal for organization:', orgId, 'by user:', authResult.userId);

    // Determine origin for return_url
    let origin = 'http://localhost:3000';
    if (req.headers.origin) {
      origin = req.headers.origin;
    } else if (req.headers['x-forwarded-host']) {
      origin = `https://${req.headers['x-forwarded-host']}`;
    }
    const return_url = `${origin}/organizations`;

    // Find or create Stripe customer
    let customer;
    const customers = await stripe.customers.list({ limit: 100 });
    customer = customers.data.find(c => c.metadata?.clerk_org_id === orgId);

    if (!customer) {
      // Create customer
      customer = await stripe.customers.create({
        metadata: { clerk_org_id: orgId }
      });
      console.log('Created new Stripe customer:', customer.id);
    }

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url
    });

    console.log('✅ Created billing portal session:', session.url);
    return res.status(200).json({ url: session.url });

  } catch (error: any) {
    console.error('❌ Error creating billing portal:', error);
    if (error.message.includes('Missing or invalid Authorization header')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (error.message.includes('User does not belong to this organization') || error.message.includes('User is not an organization admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}