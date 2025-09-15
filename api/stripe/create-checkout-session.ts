import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('=== STRIPE API ROUTE ENTRY ===');
  
  try {
    console.log('Step 1: Parsing request body...');
    const body = await request.json();
    console.log('Request body:', body);
    
    const { planType, billingFrequency, seats = 1, clerkUserId, successUrl, cancelUrl, currency, priceId } = body;

    console.log('Step 2: Validating input...');
    console.log('planType:', planType);
    console.log('billingFrequency:', billingFrequency);
    console.log('clerkUserId:', clerkUserId);
    
    // Validate input
    if (!planType || !billingFrequency || !clerkUserId) {
      console.log('❌ Missing required parameters');
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log('Step 3: Checking environment variables...');
    console.log('STRIPE_SECRET_KEY present:', !!process.env.STRIPE_SECRET_KEY);
    console.log('NEXT_PUBLIC_SUPABASE_URL present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('SUPABASE_SERVICE_ROLE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!process.env.STRIPE_SECRET_KEY) {
      console.log('❌ Stripe not configured');
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    console.log('Step 4: Importing dependencies...');
    // Import Stripe on demand
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { createClient } = require('@supabase/supabase-js');

    console.log('Step 5: Initializing Supabase client...');
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('✅ Supabase client initialized');

    console.log('Step 6: Determining price ID...');
    // Get price ID based on plan and billing frequency (fallback for legacy requests)
    let finalPriceId = priceId;
    if (!finalPriceId) {
      console.log('No priceId provided, looking up from plan/billing');
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
      console.log('Resolved priceId:', finalPriceId);
    } else {
      console.log('Using provided priceId:', finalPriceId);
    }

    if (!finalPriceId) {
      console.log('❌ Invalid plan or billing frequency');
      return NextResponse.json({ error: 'Invalid plan or billing frequency' }, { status: 400 });
    }

    console.log('Step 7: Creating or finding Stripe customer...');
    // Create or get Stripe customer
    let customer;
    try {
      console.log('7a: Listing existing customers...');
      // Try to find existing customer by Clerk user ID
      const customers = await stripe.customers.list({
        limit: 100,
      });
      console.log('Found', customers.data.length, 'existing customers');

      // Find customer with matching clerk_user_id in metadata
      customer = customers.data.find((c: any) => c.metadata?.clerk_user_id === clerkUserId);
      console.log('Existing customer found:', !!customer);

      if (!customer) {
        console.log('7b: Creating new customer...');
        // Optionally fetch email from Supabase
        let customerEmail;
        console.log('7b1: Fetching user email from Supabase...');
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('email')
          .eq('clerk_id', clerkUserId)
          .single();
        
        console.log('User data fetch result:', { userData, fetchError });
        
        if (!fetchError && userData?.email) {
          customerEmail = userData.email;
          console.log('Using email from Supabase:', customerEmail);
        } else {
          console.log('No email found in Supabase or error occurred');
        }

        console.log('7b2: Creating Stripe customer...');
        // Create new customer
        customer = await stripe.customers.create({
          email: customerEmail || undefined,
          description: `Customer for Clerk user ${clerkUserId}`,
          metadata: {
            clerk_user_id: clerkUserId
          }
        });
        console.log('✅ New customer created:', customer.id);
      } else {
        console.log('✅ Using existing customer:', customer.id);
      }
    } catch (error) {
      console.error('❌ Error creating/finding customer:', error);
      return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
    }

    console.log('Step 8: Creating Stripe checkout session...');
    // Create checkout session
    const sessionData = {
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
    };
    
    console.log('Session data:', JSON.stringify(sessionData, null, 2));
    
    const session = await stripe.checkout.sessions.create(sessionData);
    console.log('✅ Checkout session created:', session.id);

    const response = {
      sessionId: session.id,
      url: session.url,
    };
    
    console.log('✅ Returning success response:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ FATAL ERROR in create-checkout-session:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({
      error: 'Failed to create checkout session',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
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