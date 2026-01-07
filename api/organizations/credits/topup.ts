import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { orgAdminMiddleware } from '../../../src/utils/clerk/token-verification.js';

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not defined');
  }
  return new Stripe(key, {
    apiVersion: '2023-10-16' as any,
  });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stripe = getStripe();
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
    
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. Get organization
    let { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, stripe_customer_id, total_credits, name')
      .eq('clerk_org_id', orgId)
      .maybeSingle();

    // Handle missing organization or missing Stripe Customer ID
    if (!org || !org.stripe_customer_id) {
      console.log(`Organization ${orgId} missing Stripe Customer ID or record. Creating...`);
      
      try {
        // Create Stripe Customer
        const customer = await stripe.customers.create({
          name: org?.name || `Organization ${orgId}`,
          metadata: {
            clerk_org_id: orgId,
          },
        });

        const stripeCustomerId = customer.id;

        if (org) {
          // Update existing organization
          const { error: updateError } = await supabase
            .from('organizations')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('id', org.id);

          if (updateError) {
            console.error('Failed to update organization with Stripe Customer ID:', updateError);
            throw updateError;
          }
          
          // Update local object
          org.stripe_customer_id = stripeCustomerId;
        } else {
          // Create new organization record
          const { data: newOrg, error: createError } = await supabase
            .from('organizations')
            .insert({
              clerk_org_id: orgId,
              name: `Organization ${orgId}`,
              stripe_customer_id: stripeCustomerId,
              total_credits: 0,
            })
            .select('id, stripe_customer_id, total_credits, name')
            .single();

          if (createError) {
            console.error('Failed to create organization record:', createError);
            throw createError;
          }
          
          org = newOrg;
        }
      } catch (err) {
        console.error('Error ensuring organization/customer exists:', err);
        return res.status(500).json({ error: 'Failed to initialize organization billing' });
      }
    }

    if (!org?.stripe_customer_id) {
      return res.status(500).json({ error: 'Failed to retrieve Stripe Customer ID' });
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

  } catch (error: any) {
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