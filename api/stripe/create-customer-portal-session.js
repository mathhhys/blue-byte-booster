// Vercel serverless function for creating Stripe customer portal session
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

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
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('✅ Supabase client initialized');

    console.log('Step 4: Finding Stripe customer...');
    // Find the Stripe customer for this user
    let customer;
    try {
      // Try to find existing customer by Clerk user ID
      const customers = await stripe.customers.list({
        limit: 100,
      });

      // Find customer with matching clerk_user_id in metadata
      customer = customers.data.find((c) => c.metadata?.clerk_user_id === userId);
      console.log('Existing customer found:', !!customer);

      if (!customer) {
        console.log('No customer found, checking Supabase for email...');
        // Try to get user email from Supabase to create customer
        const { data: userData, error: fetchError } = await supabase
          .from('users')
          .select('email')
          .eq('clerk_id', userId)
          .single();

        if (fetchError || !userData?.email) {
          console.log('❌ No customer or email found');
          return res.status(404).json({ 
            error: 'No Stripe customer found for this user. Please make a purchase first.' 
          });
        }

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
      } else {
        console.log('✅ Using existing customer:', customer.id);
      }
    } catch (error) {
      console.error('❌ Error finding/creating customer:', error);
      return res.status(500).json({ error: 'Failed to find customer' });
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

  } catch (error) {
    console.error('❌ FATAL ERROR in create-customer-portal-session:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Failed to create customer portal session',
      details: error.message 
    });
  }
}