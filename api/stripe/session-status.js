// Vercel serverless function for Stripe session status
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  console.log('=== STRIPE SESSION STATUS API ROUTE ENTRY ===');
  
  try {
    // Only allow GET method
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('Step 1: Parsing query parameters...');
    const { session_id } = req.query;
    console.log('Session ID:', session_id);

    if (!session_id) {
      console.log('❌ Session ID is required');
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Handle mock sessions for development
    if (session_id.startsWith('cs_mock_')) {
      console.log('Mock session detected, returning error');
      return res.status(404).json({
        success: false,
        error: 'Mock session - use frontend mock implementation'
      });
    }

    console.log('Step 2: Checking Stripe configuration...');
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log('❌ Stripe not configured');
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    console.log('Step 3: Retrieving session from Stripe...');
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription'],
    });
    console.log('✅ Session retrieved:', session.id);

    // Get metadata from session first, then from subscription if available
    const metadata = session.metadata || {};
    if (session.subscription && session.subscription.metadata) {
      Object.assign(metadata, session.subscription.metadata);
    }

    const response = {
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
    };

    console.log('✅ Returning session status:', response);
    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ FATAL ERROR in session-status:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve session status',
      details: error.message
    });
  }
}