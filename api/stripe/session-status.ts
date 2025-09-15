import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    console.log('=== STRIPE SESSION STATUS ===');
    console.log('Session ID:', sessionId);

    // Handle mock sessions for development
    if (sessionId.startsWith('cs_mock_')) {
      return NextResponse.json({
        success: false,
        error: 'Mock session - use frontend mock implementation'
      }, { status: 404 });
    }

    // Import Stripe on demand
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    // Get metadata from session first, then from subscription if available
    const metadata = session.metadata || {};
    if (session.subscription && session.subscription.metadata) {
      Object.assign(metadata, session.subscription.metadata);
    }

    return NextResponse.json({
      success: true,
      data: {
        status: session.status,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency,
        customer_email: session.customer_details?.email,
        subscription_id: session.subscription?.id,
        metadata: metadata,
      },
    });

  } catch (error) {
    console.error('Error retrieving session:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve session status'
    }, { status: 500 });
  }
}