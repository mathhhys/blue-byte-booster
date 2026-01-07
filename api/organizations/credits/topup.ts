import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { orgAdminMiddleware } from '../../../src/utils/clerk/token-verification.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { org_id, credits_amount, success_url, cancel_url } = req.body;

  if (!org_id || !credits_amount || credits_amount < 100) {
    return res.status(400).json({ error: 'Organization ID and a minimum of 100 credits are required' });
  }

  try {
    // 1. Verify organization admin access
    const authResult = await orgAdminMiddleware(req, org_id);
    console.log(`🔍 API: Creating credit top-up for org: ${org_id} (Amount: ${credits_amount})`);

    // 2. Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // 3. Get organization subscription to find Stripe Customer ID
    const { data: orgSub, error: subError } = await supabase
      .from('organization_subscriptions')
      .select('stripe_customer_id')
      .eq('clerk_org_id', org_id)
      .single();

    if (subError || !orgSub?.stripe_customer_id) {
      return res.status(404).json({ error: 'Active organization subscription with billing info not found' });
    }

    // 4. Calculate price ($0.014 per credit)
    // Stripe amounts are in cents. 0.014 * 100 = 1.4 cents per credit.
    const unitAmount = 1.4; 
    const totalAmountCents = Math.round(credits_amount * unitAmount);

    if (totalAmountCents < 50) {
      return res.status(400).json({ error: 'Total amount must be at least $0.50' });
    }

    // 5. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: orgSub.stripe_customer_id,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${credits_amount} API Credits`,
              description: `One-time credit top-up for organization pool`,
            },
            unit_amount: totalAmountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: success_url || `${req.headers?.origin || 'https://www.softcodes.ai'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${req.headers?.origin || 'https://www.softcodes.ai'}/payment-cancelled`,
      metadata: {
        clerk_org_id: org_id,
        purchase_type: 'org_credit_topup',
        credits_to_add: credits_amount.toString(),
        admin_user_id: authResult.userId,
      },
    });

    console.log(`✅ Checkout session created: ${session.id}`);
    return res.status(200).json({
      success: true,
      checkout_url: session.url,
      sessionId: session.id
    });

  } catch (error: any) {
    console.error('❌ API: Exception in credit top-up endpoint:', error);
    
    if (error.message?.includes('Authorization')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (error.message?.includes('belong to this organization') || error.message?.includes('admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}