import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { orgAdminMiddleware } from '../../../src/utils/clerk/token-verification';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    // Support both camelCase and snake_case from frontend
    const orgId = body.orgId || body.org_id;
    const amount = body.amount || body.credits_amount;

    if (!orgId || !amount) {
      return res.status(400).json({ error: 'Organization ID and amount are required' });
    }

    // 1. Verify organization admin access
    const authResult = await orgAdminMiddleware(
      { headers: req.headers },
      orgId
    );

    // 2. Initialize Supabase with service role
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Get organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, stripe_customer_id, total_credits')
      .eq('clerk_org_id', orgId)
      .single();

    if (orgError || !org?.stripe_customer_id) {
      console.error('Organization not found or missing billing info:', orgError);
      return res.status(404).json(
        { error: 'Active organization subscription with billing info not found' }
      );
    }

    // 4. Create Stripe balance transaction
    await stripe.customers.createBalanceTransaction(org.stripe_customer_id, {
      amount: amount * 100, // amount in cents
      currency: 'usd',
      metadata: {
        clerk_org_id: orgId,
        description: 'Manual topup',
        admin_user_id: authResult.userId,
      },
    });

    // 5. Insert transaction record
    const { error: txError } = await supabase
      .from('organization_credit_transactions')
      .insert({
        organization_id: org.id,
        amount: amount,
        transaction_type: 'purchase',
        description: 'Manual credit top-up',
        metadata: {
          clerk_org_id: orgId,
          admin_user_id: authResult.userId,
        },
      });

    if (txError) {
      console.error('Failed to insert transaction record:', txError);
    }

    // 6. Update organization credits
    const { error: updateError } = await supabase
      .from('organizations')
      .update({
        total_credits: (org.total_credits || 0) + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id);

    if (updateError) {
      console.error('Failed to update organization credits:', updateError);
      return res.status(500).json({ error: 'Failed to update credits' });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ API: Exception in credit top-up endpoint:', error);
    
    if (error.message?.includes('Authorization') || error.message?.includes('Authentication')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (error.message?.includes('belong to this organization') || error.message?.includes('admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.status(500).json(
      { error: 'Internal server error', details: error.message }
    );
  }
}