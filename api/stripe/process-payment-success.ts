import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, clerkUserId } = await request.json();

    if (!sessionId || !clerkUserId) {
      return NextResponse.json({ error: 'Session ID and Clerk User ID are required' }, { status: 400 });
    }

    console.log('=== STRIPE PROCESS PAYMENT SUCCESS ===');
    console.log('Session ID:', sessionId);
    console.log('Clerk User ID:', clerkUserId);

    // Import dependencies
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { createClient } = require('@supabase/supabase-js');

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Handle mock sessions for development
    let session: any;
    if (sessionId.startsWith('cs_mock_')) {
      // Create mock session data for development
      session = {
        id: sessionId,
        status: 'complete',
        payment_status: 'paid',
        amount_total: 2000, // $20.00 in cents
        currency: 'usd',
        customer_details: {
          email: 'demo@example.com'
        },
        subscription: {
          id: `sub_mock_${Date.now()}`
        },
        metadata: {
          plan_type: 'pro',
          billing_frequency: 'monthly',
          seats: '1'
        }
      };
    } else {
      // Get real session details from Stripe
      if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
      }

      try {
        session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['subscription'],
        });
      } catch (stripeError) {
        console.error('Error retrieving Stripe session:', stripeError);
        return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
      }
    }

    // Extract metadata
    const metadata = session.metadata || {};
    if (session.subscription && session.subscription.metadata) {
      Object.assign(metadata, session.subscription.metadata);
    }

    const { plan_type, billing_frequency, seats = 1 } = metadata;

    if (!plan_type || !billing_frequency) {
      return NextResponse.json({ error: 'Missing payment metadata' }, { status: 400 });
    }

    // Check if user exists, create if not
    let user: any;
    try {
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', clerkUserId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw fetchError;
      }

      if (!existingUser) {
        // Create user if doesn't exist
        const { data: newUser, error: createError } = await supabase.rpc('upsert_user', {
          p_clerk_id: clerkUserId,
          p_email: session.customer_details?.email || 'unknown@example.com',
          p_plan_type: plan_type
        });

        if (createError) throw createError;

        // Fetch the created user
        const { data: createdUser, error: fetchNewError } = await supabase
          .from('users')
          .select('id')
          .eq('id', newUser)
          .single();

        if (fetchNewError) throw fetchNewError;
        user = createdUser;
      } else {
        user = existingUser;
      }
    } catch (error) {
      console.error('Error handling user:', error);
      return NextResponse.json({ error: 'Failed to process user' }, { status: 500 });
    }

    // Update user plan
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ plan_type, updated_at: new Date().toISOString() })
        .eq('clerk_id', clerkUserId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error updating user plan:', error);
      return NextResponse.json({ error: 'Failed to update user plan' }, { status: 500 });
    }

    // Create subscription record
    try {
      const { error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          stripe_subscription_id: session.subscription?.id,
          plan_type,
          billing_frequency,
          seats: parseInt(seats) || 1,
          status: 'active',
        });

      if (subError) throw subError;
    } catch (error) {
      console.error('Error creating subscription:', error);
      return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
    }

    // Grant credits
    try {
      const creditsPerSeat = 500;
      const totalCredits = creditsPerSeat * (parseInt(seats) || 1);
      
      const { error: creditError } = await supabase.rpc('grant_credits', {
        p_clerk_id: clerkUserId,
        p_amount: totalCredits,
        p_description: `${plan_type} plan credits (${seats || 1} seat${(seats || 1) > 1 ? 's' : ''})`,
        p_reference_id: session.subscription?.id,
      });

      if (creditError) throw creditError;
    } catch (error) {
      console.error('Error granting credits:', error);
      return NextResponse.json({ error: 'Failed to grant credits' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        planType: plan_type,
        billingFrequency: billing_frequency,
        seats: parseInt(seats) || 1,
        creditsGranted: 500 * (parseInt(seats) || 1)
      }
    });

  } catch (error) {
    console.error('Error processing payment success:', error);
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
  }
}