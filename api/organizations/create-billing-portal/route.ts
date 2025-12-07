import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { orgAdminMiddleware } from '../../../src/utils/clerk/token-verification.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  console.log('🟢 BILLING PORTAL ROUTE HIT');
  try {
    const body = await req.json();
    const { clerk_org_id: orgId } = body;

    if (!orgId) {
      return Response.json({ error: 'Organization ID (clerk_org_id) is required' }, { status: 400 });
    }

    // Authenticate org admin
    console.log('🔍 Calling orgAdminMiddleware for org:', orgId);
    const authResult = await orgAdminMiddleware({ headers: Object.fromEntries(req.headers.entries()) } as any, orgId);
    console.log('✅ Middleware passed for user:', authResult.userId, 'in org:', orgId);
    console.log('🔍 API: Creating billing portal for organization:', orgId, 'by user:', authResult.userId);

    // Determine origin for return_url
    let origin = 'http://localhost:3000';
    if (req.headers.get('origin')) {
      origin = req.headers.get('origin')!;
    } else if (req.headers.get('x-forwarded-host')) {
      origin = `https://${req.headers.get('x-forwarded-host')}`;
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
    return Response.json({ url: session.url });

  } catch (error: any) {
    console.error('❌ Error creating billing portal:', error);
    if (error.message.includes('Missing or invalid Authorization header')) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (error.message.includes('User does not belong to this organization') || error.message.includes('User is not an organization admin')) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}