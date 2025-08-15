// Example Express.js server for handling Stripe checkout sessions
// Deploy this separately or integrate with your backend framework

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3001;

// Supabase client for auth and real-time features
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for server-side operations
);

// PostgreSQL connection pool for direct database operations (Transaction Pooler)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database via transaction pooler');
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
});

app.use(cors());

// For Stripe webhooks, we need the raw body before JSON parsing
app.use('/api/stripe/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json());

// Create Stripe checkout session
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { planType, billingFrequency, seats = 1, clerkUserId, successUrl, cancelUrl } = req.body;

    // Validate input
    if (!planType || !billingFrequency || !clerkUserId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get price ID based on plan and billing frequency
    const priceIds = {
      pro: {
        monthly: 'price_1RvKJcH6gWxKcaTXQ4PITKei',
        yearly: 'price_1RvKJtH6gWxKcaTXfeLXklqU',
      },
      teams: {
        monthly: 'price_teams_monthly', // You need to create this in Stripe
        yearly: 'price_teams_yearly',   // You need to create this in Stripe
      },
    };

    const priceId = priceIds[planType]?.[billingFrequency];
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan or billing frequency' });
    }

    // Create or get Stripe customer
    let customer;
    try {
      // Try to find existing customer by Clerk user ID
      const customers = await stripe.customers.list({
        limit: 100, // Search through customers to find by metadata
      });

      // Find customer with matching clerk_user_id in metadata
      customer = customers.data.find(c => c.metadata?.clerk_user_id === clerkUserId);

      if (!customer) {
        // Optionally fetch email from Supabase if not passed in body
        let customerEmail = req.body.email;
        if (!customerEmail) {
          const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('email')
            .eq('clerk_id', clerkUserId)
            .single();
          if (!fetchError && userData?.email) {
            customerEmail = userData.email;
          }
        }

        // Create new customer with email and metadata
        customer = await stripe.customers.create({
          email: customerEmail || undefined,
          description: `Customer for Clerk user ${clerkUserId}`
        });
      }
    } catch (error) {
      console.error('Error creating/finding customer:', error);
      return res.status(500).json({ error: 'Failed to create customer' });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: seats,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        clerk_user_id: clerkUserId,
        plan_type: planType,
        billing_frequency: billingFrequency,
        seats: seats.toString(),
      },
      subscription_data: {
        metadata: {
          clerk_user_id: clerkUserId,
          plan_type: planType,
          billing_frequency: billingFrequency,
          seats: seats.toString(),
        },
      },
    });

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Get checkout session status
app.get('/api/stripe/session-status', async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Handle mock sessions for development
    if (session_id.startsWith('cs_mock_')) {
      return res.status(404).json({
        success: false,
        error: 'Mock session - use frontend mock implementation'
      });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription'],
    });

    // Get metadata from session first, then from subscription if available
    const metadata = session.metadata || {};
    if (session.subscription && session.subscription.metadata) {
      Object.assign(metadata, session.subscription.metadata);
    }

    res.json({
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
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session status'
    });
  }
});

// Process payment success (called from frontend after successful payment)
app.post('/api/stripe/process-payment-success', async (req, res) => {
  try {
    const { sessionId, clerkUserId } = req.body;

    if (!sessionId || !clerkUserId) {
      return res.status(400).json({ error: 'Session ID and Clerk User ID are required' });
    }

    // Handle mock sessions for development
    let session;
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
      try {
        session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['subscription'],
        });
      } catch (stripeError) {
        console.error('Error retrieving Stripe session:', stripeError);
        return res.status(400).json({ error: 'Invalid session ID' });
      }
    }

    // Extract metadata
    const metadata = session.metadata || {};
    if (session.subscription && session.subscription.metadata) {
      Object.assign(metadata, session.subscription.metadata);
    }

    const { plan_type, billing_frequency, seats = 1 } = metadata;

    if (!plan_type || !billing_frequency) {
      return res.status(400).json({ error: 'Missing payment metadata' });
    }

    // Check if user exists, create if not
    let user;
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
      return res.status(500).json({ error: 'Failed to process user' });
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
      return res.status(500).json({ error: 'Failed to update user plan' });
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
      return res.status(500).json({ error: 'Failed to create subscription' });
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
      return res.status(500).json({ error: 'Failed to grant credits' });
    }

    res.json({
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
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Process starter plan signup (no payment required)
app.post('/api/starter/process-signup', async (req, res) => {
  try {
    const { clerkUserId, email, firstName, lastName } = req.body;

    if (!clerkUserId) {
      return res.status(400).json({ error: 'Clerk User ID is required' });
    }

    // Check if user already exists
    let user;
    try {
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, plan_type, credits')
        .eq('clerk_id', clerkUserId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw fetchError;
      }

      if (existingUser) {
        // User already exists, just return success
        return res.json({
          success: true,
          message: 'User already exists',
          data: {
            planType: existingUser.plan_type,
            credits: existingUser.credits,
            isExisting: true
          }
        });
      }

      // Create new user with starter plan
      const { data: newUserId, error: createError } = await supabase.rpc('upsert_user', {
        p_clerk_id: clerkUserId,
        p_email: email || 'unknown@example.com',
        p_first_name: firstName || null,
        p_last_name: lastName || null,
        p_plan_type: 'starter'
      });

      if (createError) throw createError;

      // Fetch the created user to verify credits
      const { data: createdUser, error: fetchNewError } = await supabase
        .from('users')
        .select('id, plan_type, credits')
        .eq('id', newUserId)
        .single();

      if (fetchNewError) throw fetchNewError;
      user = createdUser;

      // Ensure user has exactly 25 credits (backup check in case upsert_user didn't set them correctly)
      if (user.credits !== 25) {
        console.log(`User ${clerkUserId} has ${user.credits} credits, adjusting to 25`);
        
        const creditAdjustment = 25 - user.credits;
        const { error: creditError } = await supabase.rpc('grant_credits', {
          p_clerk_id: clerkUserId,
          p_amount: creditAdjustment,
          p_description: 'Starter plan credits adjustment',
          p_reference_id: null
        });

        if (creditError) {
          console.error('Error adjusting credits:', creditError);
          // Don't fail the request, just log the error
        } else {
          user.credits = 25;
        }
      }

    } catch (error) {
      console.error('Error handling user:', error);
      return res.status(500).json({ error: 'Failed to process user' });
    }

    res.json({
      success: true,
      message: 'Starter plan activated successfully',
      data: {
        planType: 'starter',
        credits: 25, // Always return 25 for starter plan
        isExisting: false
      }
    });

  } catch (error) {
    console.error('Error processing starter signup:', error);
    res.status(500).json({ error: 'Failed to process starter signup' });
  }
});

// Clerk webhook handler for user creation
app.post('/api/clerk/webhooks', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = req.body;
    
    // For development, we'll accept any webhook without signature verification
    // In production, you should verify the webhook signature
    
    console.log('Received Clerk webhook:', event.type);
    
    if (event.type === 'user.created') {
      const user = event.data;
      
      try {
        // Create user in database with starter plan by default
        const { data: newUserId, error: createError } = await supabase.rpc('upsert_user', {
          p_clerk_id: user.id,
          p_email: user.email_addresses?.[0]?.email_address || 'unknown@example.com',
          p_first_name: user.first_name || null,
          p_last_name: user.last_name || null,
          p_plan_type: 'starter'
        });

        if (createError) {
          console.error('Error creating user from webhook:', createError);
          // Don't fail the webhook, just log the error
        } else {
          console.log(`Successfully created user ${user.id} from webhook`);
        }
      } catch (error) {
        console.error('Error processing user.created webhook:', error);
        // Don't fail the webhook, just log the error
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('Error processing Clerk webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Stripe webhook handler
app.post('/api/stripe/webhooks', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Webhook event handlers
async function handleCheckoutSessionCompleted(session) {
  const { clerk_user_id, plan_type, billing_frequency, seats } = session.metadata || {};
  
  try {
    if (!clerk_user_id || !plan_type || !billing_frequency) {
      console.error('Missing required metadata in checkout session:', session.metadata);
      return;
    }

    // Get user first
    const { data: userData, error: userFetchError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerk_user_id)
      .single();

    if (userFetchError || !userData) {
      console.error('User not found for clerk_id:', clerk_user_id);
      return;
    }

    // Update user plan in Supabase
    const { error: userError } = await supabase
      .from('users')
      .update({ plan_type })
      .eq('clerk_id', clerk_user_id);

    if (userError) throw userError;

    // Create subscription record
    const { error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userData.id,
        stripe_subscription_id: session.subscription,
        plan_type,
        billing_frequency,
        seats: parseInt(seats) || 1,
        status: 'active',
      });

    if (subError) throw subError;

    // Grant credits
    const creditsPerSeat = 500;
    const totalCredits = creditsPerSeat * (parseInt(seats) || 1);
    
    const { error: creditError } = await supabase.rpc('grant_credits', {
      p_clerk_id: clerk_user_id,
      p_amount: totalCredits,
      p_description: `${plan_type} plan credits (${seats || 1} seat${(seats || 1) > 1 ? 's' : ''})`,
      p_reference_id: session.subscription,
    });

    if (creditError) throw creditError;

    console.log(`Successfully processed checkout for user ${clerk_user_id}`);
  } catch (error) {
    console.error('Error processing checkout completion:', error);
  }
}

async function handlePaymentSucceeded(invoice) {
  console.log('Payment succeeded:', invoice.id);
  // Handle recurring payment success
}

async function handlePaymentFailed(invoice) {
  console.log('Payment failed:', invoice.id);
  // Handle payment failure
}

async function handleSubscriptionUpdated(subscription) {
  console.log('Subscription updated:', subscription.id);
  // Handle subscription changes
}

async function handleSubscriptionDeleted(subscription) {
  console.log('Subscription deleted:', subscription.id);
  // Handle subscription cancellation
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;