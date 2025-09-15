import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { planType, billingFrequency, seats = 1, clerkUserId, successUrl, cancelUrl, currency, priceId } = await request.json();

    // Validate input
    if (!planType || !billingFrequency || !clerkUserId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log('=== STRIPE CREATE CHECKOUT SESSION ===');
    console.log('Plan:', planType);
    console.log('Billing:', billingFrequency);
    console.log('Currency:', currency);
    console.log('Price ID:', priceId);
    console.log('Seats:', seats);

    // Import Stripe on demand
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { createClient } = require('@supabase/supabase-js');

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get price ID based on plan and billing frequency (fallback for legacy requests)
    let finalPriceId = priceId;
    if (!finalPriceId) {
      const priceIds: Record<string, Record<string, string>> = {
        pro: {
          monthly: 'price_1RvKJcH6gWxKcaTXQ4PITKei',
          yearly: 'price_1RvKJtH6gWxKcaTXfeLXklqU',
        },
        teams: {
          monthly: 'price_teams_monthly', // You need to create this in Stripe
          yearly: 'price_teams_yearly',   // You need to create this in Stripe
        },
      };
      finalPriceId = priceIds[planType]?.[billingFrequency];
    }

    if (!finalPriceId) {
      return NextResponse.json({ error: 'Invalid plan or billing frequency' }, { status: 400 });
    }

    // Create or get Stripe customer
    let customer;
    try {
      // Try to find existing customer by Clerk user ID
      const customers = await stripe.customers.list({
        limit: 100,
      });

      // Find customer with matching clerk_user_id in metadata
      customer = customers.data.find((c: any) => c.metadata?.clerk_user_id === clerkUserId);

      if (!customer) {
        // Optionally fetch email from Supabase
        let customerEmail;
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('email')
          .eq('clerk_id', clerkUserId)
          .single();
        
        if (!fetchError && userData?.email) {
          customerEmail = userData.email;
        }

        // Create new customer
        customer = await stripe.customers.create({
          email: customerEmail || undefined,
          description: `Customer for Clerk user ${clerkUserId}`,
          metadata: {
            clerk_user_id: clerkUserId
          }
        });
      }
    } catch (error) {
      console.error('Error creating/finding customer:', error);
      return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: finalPriceId,
          quantity: seats,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${request.nextUrl.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${request.nextUrl.origin}/payment-cancelled`,
      metadata: {
        clerk_user_id: clerkUserId,
        plan_type: planType,
        billing_frequency: billingFrequency,
        seats: seats.toString(),
        currency: currency || 'USD',
        price_id: finalPriceId,
      },
      subscription_data: {
        metadata: {
          clerk_user_id: clerkUserId,
          plan_type: planType,
          billing_frequency: billingFrequency,
          seats: seats.toString(),
          currency: currency || 'USD',
        },
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}