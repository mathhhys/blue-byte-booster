import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { orgAdminMiddleware } from '../../../../../src/utils/clerk/token-verification';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Support both camelCase and snake_case from frontend
    const orgId = body.orgId || body.org_id;
    const amount = body.amount || body.credits_amount;

    if (!orgId || !amount) {
      return NextResponse.json({ error: 'Organization ID and amount are required' }, { status: 400 });
    }

    // 1. Verify organization admin access
    const authResult = await orgAdminMiddleware(
      { headers: Object.fromEntries(request.headers.entries()) } as any,
      orgId
    );

    // 2. Initialize Supabase with service role
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl!, supabaseKey!);

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
        return NextResponse.json(
          { error: 'Failed to initialize organization billing' },
          { status: 500 }
        );
      }
    }

    if (!org?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Failed to retrieve Stripe Customer ID' },
        { status: 500 }
      );
    }

    // 4. Create Stripe Checkout Session
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://softcodes.ai';
    
    const session = await stripe.checkout.sessions.create({
      customer: org.stripe_customer_id,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Organization Credits Top-up',
              description: `${amount} credits`,
            },
            unit_amount: 100, // $1.00 per credit
          },
          quantity: amount,
        },
      ],
      metadata: {
        purchase_type: 'org_credit_topup',
        clerk_org_id: orgId,
        credits_to_add: amount,
        admin_user_id: authResult.userId,
      },
      success_url: `${origin}/dashboard/organization/${orgId}/billing?success=true`,
      cancel_url: `${origin}/dashboard/organization/${orgId}/billing?canceled=true`,
    });

    return NextResponse.json({ success: true, checkout_url: session.url });

  } catch (error: any) {
    console.error('❌ API: Exception in credit top-up endpoint:', error);
    
    if (error.message?.includes('Authorization') || error.message?.includes('Authentication')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (error.message?.includes('belong to this organization') || error.message?.includes('admin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}