// Vercel serverless function for processing payment success
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

export default async function handler(req, res) {
  console.log('=== STRIPE PROCESS PAYMENT SUCCESS API ROUTE ENTRY ===');
  
  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('Step 1: Parsing request body...');
    const { sessionId, clerkUserId } = req.body;
    console.log('Request body:', req.body);

    if (!sessionId || !clerkUserId) {
      console.log('❌ Missing required parameters');
      return res.status(400).json({ error: 'Session ID and Clerk User ID are required' });
    }

    console.log('Step 2: Initializing dependencies...');
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('✅ Supabase client initialized');

    // Handle mock sessions for development
    let session;
    if (sessionId.startsWith('cs_mock_')) {
      console.log('Step 3: Creating mock session data...');
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
      console.log('Step 3: Retrieving real session from Stripe...');
      // Get real session details from Stripe
      if (!process.env.STRIPE_SECRET_KEY) {
        console.log('❌ Stripe not configured');
        return res.status(500).json({ error: 'Stripe not configured' });
      }

      try {
        session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['subscription'],
        });
        console.log('✅ Session retrieved:', session.id);
      } catch (stripeError) {
        console.error('❌ Error retrieving Stripe session:', stripeError);
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
      console.log('❌ Missing payment metadata');
      return res.status(400).json({ error: 'Missing payment metadata' });
    }

    console.log('Step 4: Processing user...');
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
        console.log('Creating new user...');
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
      console.error('❌ Error handling user:', error);
      return res.status(500).json({ error: 'Failed to process user' });
    }

    console.log('Step 5: Updating user plan...');
    // Update user plan
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ plan_type, updated_at: new Date().toISOString() })
        .eq('clerk_id', clerkUserId);

      if (updateError) throw updateError;
      console.log('✅ User plan updated');
    } catch (error) {
      console.error('❌ Error updating user plan:', error);
      return res.status(500).json({ error: 'Failed to update user plan' });
    }

    console.log('Step 6: Creating subscription record...');
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
      console.log('✅ Subscription record created');
    } catch (error) {
      console.error('❌ Error creating subscription:', error);
      return res.status(500).json({ error: 'Failed to create subscription' });
    }

    console.log('Step 7: Granting credits...');
    // Grant credits based on billing frequency
    try {
      // Calculate credits based on billing frequency and seats
      const baseCredits = billing_frequency === 'yearly' ? 6000 : 500;
      const totalCredits = baseCredits * (parseInt(seats) || 1);
      
      const { error: creditError } = await supabase.rpc('grant_credits', {
        p_clerk_id: clerkUserId,
        p_amount: totalCredits,
        p_description: `${plan_type} plan ${billing_frequency} credits (${seats || 1} seat${(seats || 1) > 1 ? 's' : ''})`,
        p_reference_id: session.subscription?.id,
      });

      if (creditError) throw creditError;
      console.log('✅ Credits granted:', totalCredits);
    } catch (error) {
      console.error('❌ Error granting credits:', error);
      return res.status(500).json({ error: 'Failed to grant credits' });
    }

    const response = {
      success: true,
      message: 'Payment processed successfully',
      data: {
        planType: plan_type,
        billingFrequency: billing_frequency,
        seats: parseInt(seats) || 1,
        creditsGranted: (billing_frequency === 'yearly' ? 6000 : 500) * (parseInt(seats) || 1)
      }
    };

    console.log('✅ Payment processing completed:', response);
    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ FATAL ERROR in process-payment-success:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Failed to process payment',
      details: error.message 
    });
  }
}