import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-08-27.basil',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const slug = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug || '';

  if (slug === 'create-checkout-session' && method === 'POST') {
    // Logic from create-checkout-session.js
    console.log('=== STRIPE API ROUTE ENTRY ===');
    
    try {
      console.log('Step 1: Parsing request body...');
      const { planType, billingFrequency, seats = 1, clerkUserId, successUrl, cancelUrl, currency, priceId } = req.body;
      console.log('Request body:', req.body);

      console.log('Step 2: Validating input...');
      console.log('planType:', planType);
      console.log('billingFrequency:', billingFrequency);
      console.log('clerkUserId:', clerkUserId);
      
      // Validate input
      if (!planType || !billingFrequency || !clerkUserId) {
        console.log('❌ Missing required parameters');
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      console.log('Step 3: Checking environment variables...');
      console.log('STRIPE_SECRET_KEY present:', !!process.env.STRIPE_SECRET_KEY);
      console.log('NEXT_PUBLIC_SUPABASE_URL present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('VITE_SUPABASE_URL present:', !!process.env.VITE_SUPABASE_URL);
      console.log('SUPABASE_SERVICE_ROLE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

      if (!process.env.STRIPE_SECRET_KEY) {
        console.log('❌ Stripe not configured - STRIPE_SECRET_KEY missing');
        console.log('Available env vars starting with STRIPE:', Object.keys(process.env).filter(key => key.startsWith('STRIPE')));
        return res.status(500).json({ error: 'Stripe not configured' });
      }
      
      // Validate Stripe key format
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      console.log('STRIPE_SECRET_KEY format check:');
      console.log('- Starts with sk_:', stripeKey.startsWith('sk_'));
      console.log('- Length:', stripeKey.length);
      console.log('- Contains test/live indicator:', stripeKey.includes('test') || stripeKey.includes('live'));

      console.log('Step 4: Initializing Supabase client...');
      // Initialize Supabase client (try multiple env var names)
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      console.log('Supabase URL check:');
      console.log('- SUPABASE_URL present:', !!process.env.SUPABASE_URL);
      console.log('- NEXT_PUBLIC_SUPABASE_URL present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.log('- VITE_SUPABASE_URL present:', !!process.env.VITE_SUPABASE_URL);
      console.log('- SUPABASE_SERVICE_ROLE_KEY present:', !!supabaseKey);

      if (!supabaseUrl) {
        console.error('❌ No Supabase URL found in environment variables');
        return res.status(500).json({
          error: 'Failed to create checkout session',
          details: 'supabaseUrl is required.'
        });
      }

      if (!supabaseKey) {
        console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
        return res.status(500).json({
          error: 'Failed to create checkout session',
          details: 'supabaseKey is required.'
        });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ Supabase client initialized with URL:', supabaseUrl);

      console.log('Step 5: Validating price ID...');
      // Price ID must be provided by the frontend (supports multi-currency)
      if (!priceId) {
        console.log('❌ No priceId provided - required for multi-currency support');
        console.log('Request included currency:', currency);
        return res.status(400).json({
          error: 'Price ID is required',
          details: 'The frontend must provide the correct price ID for the selected currency and plan'
        });
      }

      const finalPriceId = priceId;
      console.log('Using priceId:', finalPriceId, 'for currency:', currency || 'not specified');
      console.log('Plan:', planType, 'Billing:', billingFrequency, 'Seats:', seats);

      // Validate price exists in Stripe
      console.log('5a: Retrieving price from Stripe to validate...');
      try {
        const priceData = await stripe.prices.retrieve(finalPriceId);
        console.log('✅ Price retrieved successfully:', {
          id: priceData.id,
          currency: priceData.currency,
          unit_amount: priceData.unit_amount,
          recurring: priceData.recurring,
          active: priceData.active
        });
      } catch (priceError: any) {
        console.error('❌ Error retrieving price:', priceError);
        console.error('Price error details:', {
          name: priceError.name,
          message: priceError.message,
          type: priceError.type,
          code: priceError.code
        });
        return res.status(400).json({
          error: 'Invalid price ID',
          details: 'The provided price ID does not exist in Stripe',
          stripeError: {
            type: priceError.type,
            code: priceError.code,
            message: priceError.message
          }
        });
      }

      console.log('Step 6: Creating or finding Stripe customer...');
      // Create or get Stripe customer
      let customer;
      try {
        console.log('6a: Listing existing customers...');
        // Try to find existing customer by Clerk user ID
        const customers = await stripe.customers.list({
          limit: 100,
        });
        console.log('Found', customers.data.length, 'existing customers');

        // Find customer with matching clerk_user_id in metadata
        customer = customers.data.find((c) => c.metadata?.clerk_user_id === clerkUserId);
        console.log('Existing customer found:', !!customer);

        if (!customer) {
          console.log('6b: Creating new customer...');
          // Optionally fetch email from Supabase
          let customerEmail;
          console.log('6b1: Fetching user email from Supabase...');
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

          console.log('6b2: Creating Stripe customer...');
          const customerData = {
            email: customerEmail || undefined,
            description: `Customer for Clerk user ${clerkUserId}`,
            metadata: {
              clerk_user_id: clerkUserId
            }
          };
          console.log('Customer creation data:', customerData);
          
          try {
            customer = await stripe.customers.create(customerData);
            console.log('✅ New customer created:', customer.id);
          } catch (customerError: any) {
            console.error('❌ Error creating Stripe customer:', customerError);
            console.error('Customer error details:', {
              name: customerError.name,
              message: customerError.message,
              type: customerError.type,
              code: customerError.code
            });
            throw customerError;
          }
        } else {
          console.log('✅ Using existing customer:', customer.id);
        }
      } catch (error) {
        console.error('❌ Error creating/finding customer:', error);
        return res.status(500).json({ error: 'Failed to create customer' });
      }

      console.log('Step 7: Creating Stripe checkout session...');
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
        success_url: successUrl || `${req.headers.origin || 'https://www.softcodes.ai'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${req.headers.origin || 'https://www.softcodes.ai'}/payment-cancelled`,
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
      
      let session;
      try {
        // @ts-ignore
        session = await stripe.checkout.sessions.create(sessionData);
        console.log('✅ Checkout session created:', session.id);
        console.log('Session URL:', session.url);
      } catch (sessionError: any) {
        console.error('❌ Error creating Stripe checkout session:', sessionError);
        console.error('Session error details:', {
          name: sessionError.name,
          message: sessionError.message,
          type: sessionError.type,
          code: sessionError.code,
          param: sessionError.param
        });
        console.error('Session data that caused error:', JSON.stringify(sessionData, null, 2));
        throw sessionError;
      }
      
      const response = {
        sessionId: session.id,
        url: session.url,
      };
      
      console.log('✅ Returning success response:', response);
      return res.status(200).json(response);

    } catch (error: any) {
      console.error('❌ FATAL ERROR in create-checkout-session:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Error code:', error.code);
      console.error('Error type:', error.type);
      
      // Additional context for debugging
      console.error('Request body that caused error:', JSON.stringify(req.body, null, 2));
      console.error('Environment check:');
      console.error('- STRIPE_SECRET_KEY present:', !!process.env.STRIPE_SECRET_KEY);
      console.error('- STRIPE_SECRET_KEY length:', process.env.STRIPE_SECRET_KEY?.length || 0);
      console.error('- NEXT_PUBLIC_SUPABASE_URL present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
      console.error('- VITE_SUPABASE_URL present:', !!process.env.VITE_SUPABASE_URL);
      console.error('- SUPABASE_SERVICE_ROLE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
      let supabaseUrl;
      // Check if it's a Stripe-specific error
      if (error.type) {
        console.error('This is a Stripe API error');
        console.error('Stripe error details:', {
          type: error.type,
          code: error.code,
          decline_code: error.decline_code,
          param: error.param,
          message: error.message
        });
      }
      
      return res.status(500).json({
        error: 'Failed to create checkout session',
        details: error.message,
        errorType: error.name || 'Unknown',
        stripeError: error.type ? {
          type: error.type,
          code: error.code,
          param: error.param
        } : null
      });
    }
  } else if (slug === 'create-customer-portal-session' && method === 'POST') {
    // Logic from create-customer-portal-session.js
    console.log('=== STRIPE CUSTOMER PORTAL SESSION API ROUTE ENTRY ===');
    
    try {
      console.log('Step 1: Parsing request body...');
      const { userId } = req.body;
      console.log('Request body:', req.body);

      if (!userId) {
        console.log('❌ User ID is required');
        return res.status(400).json({ error: 'User ID is required' });
      }

      console.log('Step 2: Checking Stripe configuration...');
      if (!process.env.STRIPE_SECRET_KEY) {
        console.log('❌ Stripe not configured');
        return res.status(500).json({ error: 'Stripe not configured' });
      }

      console.log('Step 3: Initializing Supabase client...');
      // Initialize Supabase client
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl) {
        console.error('❌ SUPABASE_URL environment variable is not set');
        return res.status(500).json({
          error: 'Failed to create customer portal session',
          details: 'supabaseUrl is required.'
        });
      }

      if (!supabaseKey) {
        console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
        return res.status(500).json({
          error: 'Failed to create customer portal session',
          details: 'supabaseKey is required.'
        });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ Supabase client initialized');

      console.log('Step 4: Finding Stripe customer...');
      // Find the Stripe customer for this user
      let customer;
      try {
        // First, check if user already has a stripe_customer_id in database
        console.log('Checking for existing stripe_customer_id in database...');
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('email, stripe_customer_id')
          .eq('clerk_id', userId)
          .single();

        if (fetchError) {
          console.error('❌ Database error fetching user:', fetchError);
          return res.status(500).json({ error: 'Database error' });
        }

        if (!userData) {
          console.log('❌ User not found in database');
          return res.status(404).json({ error: 'User not found' });
        }

        // If user already has a stripe_customer_id, use it
        if (userData.stripe_customer_id) {
          console.log('✅ Found existing stripe_customer_id:', userData.stripe_customer_id);
          try {
            customer = await stripe.customers.retrieve(userData.stripe_customer_id);
            console.log('✅ Customer retrieved from Stripe');
          } catch (stripeError: any) {
            console.log('⚠️ Customer not found in Stripe, will create new one');
            userData.stripe_customer_id = null; // Reset to trigger creation
          }
        }

        // If no stripe_customer_id or retrieval failed, create/find customer
        if (!userData.stripe_customer_id) {
          console.log('No stripe_customer_id found, searching by email...');

          // Try to find existing customer by email first
          const existingCustomers = await stripe.customers.list({
            email: userData.email,
            limit: 1,
          });

          if (existingCustomers.data.length > 0) {
            customer = existingCustomers.data[0];
            console.log('✅ Found existing customer by email:', customer.id);
          } else {
            console.log('Creating new customer...');
            // Create new customer
            customer = await stripe.customers.create({
              email: userData.email,
              description: `Customer for Clerk user ${userId}`,
              metadata: {
                clerk_user_id: userId
              }
            });
            console.log('✅ New customer created:', customer.id);
          }

          // Update database with stripe_customer_id
          const { error: updateError } = await supabase
            .from('users')
            .update({ stripe_customer_id: customer.id })
            .eq('clerk_id', userId);

          if (updateError) {
            console.error('⚠️ Failed to update stripe_customer_id in database:', updateError);
            // Don't fail the request, just log the error
          }
        }
      } catch (error) {
        console.error('❌ Error finding/creating customer:', error);
        return res.status(500).json({ error: 'Failed to find or create customer' });
      }

      console.log('Step 5: Creating customer portal session...');
      // Create customer portal session
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customer.id,
        return_url: `${req.headers.origin || 'https://www.softcodes.ai'}/dashboard`,
      });
      console.log('✅ Portal session created:', portalSession.id);

      const response = {
        success: true,
        url: portalSession.url,
      };

      console.log('✅ Returning portal session response:', response);
      return res.status(200).json(response);

    } catch (error: any) {
      console.error('❌ FATAL ERROR in create-customer-portal-session:', error);
      console.error('Error stack:', error.stack);
      return res.status(500).json({ 
        error: 'Failed to create customer portal session',
        details: error.message 
      });
    }
  } else if (slug === 'process-payment-success' && method === 'POST') {
    // Logic from process-payment-success.js
    console.log('=== STRIPE PROCESS PAYMENT SUCCESS API ROUTE ENTRY ===');
    
    try {
      console.log('Step 1: Parsing request body...');
      const { sessionId, clerkUserId } = req.body;
      console.log('Request body:', req.body);

      if (!sessionId || !clerkUserId) {
        console.log('❌ Missing required parameters');
        return res.status(400).json({ error: 'Session ID and Clerk User ID are required' });
      }

      console.log('Step 2: Initializing dependencies...');
      // Initialize Supabase client
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl) {
        console.error('❌ No Supabase URL found in environment variables');
        return res.status(500).json({
          error: 'Failed to process payment',
          details: 'supabaseUrl is required.'
        });
      }

      if (!supabaseKey) {
        console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
        return res.status(500).json({
          error: 'Failed to process payment',
          details: 'supabaseKey is required.'
        });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ Supabase client initialized');

      // Handle mock sessions for development
      let session: any;
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
        } catch (stripeError: any) {
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

    } catch (error: any) {
      console.error('❌ FATAL ERROR in process-payment-success:', error);
      console.error('Error stack:', error.stack);
      return res.status(500).json({ 
        error: 'Failed to process payment',
        details: error.message 
      });
    }
  } else if (slug === 'session-status' && method === 'GET') {
    // Logic from session-status.js
    console.log('=== STRIPE SESSION STATUS API ROUTE ENTRY ===');
    
    try {
      console.log('Step 1: Parsing query parameters...');
      const { session_id } = req.query;
      console.log('Session ID:', session_id);

      if (!session_id) {
        console.log('❌ Session ID is required');
        return res.status(400).json({ error: 'Session ID is required' });
      }

      // Handle mock sessions for development
      if (typeof session_id === 'string' && session_id.startsWith('cs_mock_')) {
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
      const session = await stripe.checkout.sessions.retrieve(session_id as string, {
        expand: ['subscription'],
      });
      console.log('✅ Session retrieved:', session.id);

      // Get metadata from session first, then from subscription if available
      const metadata = session.metadata || {};
      if (session.subscription && (session.subscription as any).metadata) {
        Object.assign(metadata, (session.subscription as any).metadata);
      }

      const response = {
        success: true,
        data: {
          status: session.status,
          payment_status: session.payment_status,
          amount_total: session.amount_total,
          currency: session.currency,
          customer_email: (session as any).customer_details?.email,
          subscription_id: (session as any).subscription?.id,
          metadata: metadata,
        },
      };

      console.log('✅ Returning session status:', response);
      return res.status(200).json(response);

    } catch (error: any) {
      console.error('❌ FATAL ERROR in session-status:', error);
      console.error('Error stack:', error.stack);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve session status',
        details: error.message
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}