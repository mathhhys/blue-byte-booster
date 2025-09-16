// Vercel serverless function for credit purchases with Stripe
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil',
});

export default async function handler(req, res) {
  console.log('=== CREDIT PURCHASE API ROUTE ENTRY ===');

  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('Step 1: Parsing request body...');
    const { clerkUserId, credits, amount, currency = 'EUR' } = req.body;
    console.log('Request body:', req.body);

    if (!clerkUserId || !credits || !amount) {
      console.log('❌ Missing required parameters');
      return res.status(400).json({ error: 'Missing required parameters: clerkUserId, credits, amount' });
    }

    // Validate credits amount
    const creditsNum = parseInt(credits);
    if (isNaN(creditsNum) || creditsNum < 1) {
      return res.status(400).json({ error: 'Invalid credits amount' });
    }

    // Validate amount (should be in cents)
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    console.log('Step 2: Checking Stripe configuration...');
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log('❌ Stripe not configured');
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    console.log('Step 3: Initializing Supabase client...');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase configuration missing');
      return res.status(500).json({ error: 'Database configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized');

    console.log('Step 4: Finding or creating Stripe customer...');
    // Get or create Stripe customer
    let customer;
    try {
      // First, check if user already has a stripe_customer_id in database
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('email, stripe_customer_id')
        .eq('clerk_id', clerkUserId)
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
        } catch (stripeError) {
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
            description: `Customer for Clerk user ${clerkUserId}`,
            metadata: {
              clerk_user_id: clerkUserId
            }
          });
          console.log('✅ New customer created:', customer.id);
        }

        // Update database with stripe_customer_id
        const { error: updateError } = await supabase
          .from('users')
          .update({ stripe_customer_id: customer.id })
          .eq('clerk_id', clerkUserId);

        if (updateError) {
          console.error('⚠️ Failed to update stripe_customer_id in database:', updateError);
          // Don't fail the request, just log the error
        }
      }
    } catch (error) {
      console.error('❌ Error finding/creating customer:', error);
      return res.status(500).json({ error: 'Failed to find or create customer' });
    }

    console.log('Step 5: Creating Stripe checkout session...');
    // Create checkout session for credit purchase
    const sessionData = {
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `${credits} Credits`,
              description: `Purchase ${credits} credits for your account`,
            },
            unit_amount: Math.round(amountNum * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin || 'https://www.softcodes.ai'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || 'https://www.softcodes.ai'}/dashboard`,
      metadata: {
        clerk_user_id: clerkUserId,
        credits: credits.toString(),
        purchase_type: 'credit_purchase',
      },
    };

    console.log('Session data:', JSON.stringify(sessionData, null, 2));

    const session = await stripe.checkout.sessions.create(sessionData);
    console.log('✅ Checkout session created:', session.id);

    const response = {
      success: true,
      sessionId: session.id,
      url: session.url,
    };

    console.log('✅ Returning checkout session response:', response);
    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ FATAL ERROR in credit-purchase:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: 'Failed to create credit purchase session',
      details: error.message
    });
  }
}