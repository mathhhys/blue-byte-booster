// Vercel serverless function for Stripe checkout session creation
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  console.log('=== STRIPE API ROUTE ENTRY ===');
  
  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    console.log('Using Supabase URL:', supabaseUrl ? 'Found' : 'Not found');

    const supabase = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('✅ Supabase client initialized');

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
    console.log('=== PRICE ID DEBUG ===');
    console.log('PriceId from frontend:', finalPriceId);
    console.log('Currency from frontend:', currency || 'not specified');
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
    } catch (priceError) {
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
        } catch (customerError) {
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
      session = await stripe.checkout.sessions.create(sessionData);
      console.log('✅ Checkout session created:', session.id);
      console.log('Session URL:', session.url);
    } catch (sessionError) {
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

  } catch (error) {
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
    console.error('- Supabase URL used:', supabaseUrl ? 'Found' : 'Not found');
    
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
}