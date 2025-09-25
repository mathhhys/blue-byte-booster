// Consolidated Stripe API handler
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
});

export default async function handler(req, res) {
  const { action } = req.query;
  
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    switch (action) {
      case 'create-checkout-session':
        return await handleCreateCheckoutSession(req, res);
      case 'session-status':
        return await handleSessionStatus(req, res);
      case 'create-customer-portal-session':
        return await handleCreateCustomerPortalSession(req, res);
      case 'process-payment-success':
        return await handleProcessPaymentSuccess(req, res);
      default:
        return res.status(404).json({ error: 'Action not found' });
    }
  } catch (error) {
    console.error('Stripe API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleCreateCheckoutSession(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { priceId, successUrl, cancelUrl, customerEmail, metadata } = req.body;

  if (!priceId) {
    return res.status(400).json({ error: 'Missing priceId' });
  }

  try {
    const sessionData = {
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl || `${req.headers.origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.origin}/payment/cancelled`,
      metadata: metadata || {}
    };

    if (customerEmail) {
      sessionData.customer_email = customerEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionData);
    
    return res.status(200).json({ 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}

async function handleSessionStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    return res.status(200).json({
      status: session.status,
      customerEmail: session.customer_details?.email,
      subscriptionId: session.subscription
    });
  } catch (error) {
    console.error('Error retrieving session status:', error);
    return res.status(500).json({ error: 'Failed to retrieve session status' });
  }
}

async function handleCreateCustomerPortalSession(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { customerId, returnUrl } = req.body;

  if (!customerId) {
    return res.status(400).json({ error: 'Missing customerId' });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${req.headers.origin}/dashboard`
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    return res.status(500).json({ error: 'Failed to create customer portal session' });
  }
}

async function handleProcessPaymentSuccess(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid') {
      // Handle successful payment logic here
      // This could include updating database, sending emails, etc.
      
      return res.status(200).json({
        success: true,
        customerEmail: session.customer_details?.email,
        subscriptionId: session.subscription
      });
    } else {
      return res.status(400).json({ error: 'Payment not completed' });
    }
  } catch (error) {
    console.error('Error processing payment success:', error);
    return res.status(500).json({ error: 'Failed to process payment success' });
  }
}