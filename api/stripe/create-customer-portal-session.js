// Vercel serverless function for creating Stripe customer portal session
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

export default async function handler(req, res) {
  console.log('=== STRIPE CUSTOMER PORTAL SESSION API ROUTE ENTRY ===');
  
  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

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
        console.log('🔍 DEBUG: Found existing stripe_customer_id in DB:', userData.stripe_customer_id);
        try {
          customer = await stripe.customers.retrieve(userData.stripe_customer_id);
          console.log('✅ DEBUG: Customer retrieved from Stripe:', customer.id);
          console.log('🔍 DEBUG: Customer email in Stripe:', customer.email);
          console.log('🔍 DEBUG: Customer metadata:', customer.metadata);
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
    console.log('🔍 DEBUG: Creating portal session for customer:', customer.id);
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

  } catch (error) {
    console.error('❌ FATAL ERROR in create-customer-portal-session:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Failed to create customer portal session',
      details: error.message 
    });
  }
}