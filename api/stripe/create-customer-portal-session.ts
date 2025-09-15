import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log('=== STRIPE CREATE CUSTOMER PORTAL SESSION ===');
    console.log('Clerk User ID:', userId);

    // Import dependencies
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

    // Find the Stripe customer for this user
    let customer;
    try {
      // Try to find existing customer by Clerk user ID
      const customers = await stripe.customers.list({
        limit: 100,
      });

      // Find customer with matching clerk_user_id in metadata
      customer = customers.data.find((c: any) => c.metadata?.clerk_user_id === userId);

      if (!customer) {
        // Try to get user email from Supabase to create customer
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('email')
          .eq('clerk_id', userId)
          .single();

        if (fetchError || !userData?.email) {
          return NextResponse.json({ 
            error: 'No Stripe customer found for this user. Please make a purchase first.' 
          }, { status: 404 });
        }

        // Create new customer
        customer = await stripe.customers.create({
          email: userData.email,
          description: `Customer for Clerk user ${userId}`,
          metadata: {
            clerk_user_id: userId
          }
        });
      }
    } catch (error) {
      console.error('Error finding/creating customer:', error);
      return NextResponse.json({ error: 'Failed to find customer' }, { status: 500 });
    }

    // Create customer portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${request.nextUrl.origin}/dashboard`,
    });

    return NextResponse.json({
      success: true,
      url: portalSession.url,
    });

  } catch (error) {
    console.error('Error creating customer portal session:', error);
    return NextResponse.json({ error: 'Failed to create customer portal session' }, { status: 500 });
  }
}