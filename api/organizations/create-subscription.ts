import { orgAdminMiddleware } from '../../src/utils/clerk/token-verification.js';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clerk_org_id, plan_type, billing_frequency, seats_total } = req.body;

  console.log('🔍 DEBUG: Create subscription endpoint - Received body:', req.body);
  console.log('🔍 DEBUG: clerk_org_id:', clerk_org_id);
  console.log('🔍 DEBUG: plan_type:', plan_type);
  console.log('🔍 DEBUG: billing_frequency:', billing_frequency);
  console.log('🔍 DEBUG: seats_total:', seats_total);

  if (!clerk_org_id) {
    console.log('❌ DEBUG: No organization ID found in request body');
    return res.status(400).json({ error: 'Organization ID is required' });
  }

  if (!plan_type || !billing_frequency || !seats_total) {
    console.log('❌ DEBUG: Missing required subscription parameters');
    return res.status(400).json({ error: 'Missing required subscription parameters' });
  }

  console.log('✅ DEBUG: Creating subscription for organization ID:', clerk_org_id);

  try {
    // Verify organization admin access
    const authResult = await orgAdminMiddleware(req, clerk_org_id as string);
    console.log('🔍 API: Creating subscription for organization:', clerk_org_id, 'by user:', authResult.userId);

    // Check Stripe configuration
    console.log('🔍 DEBUG: STRIPE_SECRET_KEY present:', !!process.env.STRIPE_SECRET_KEY);
    console.log('🔍 DEBUG: STRIPE_SECRET_KEY starts with sk_:', process.env.STRIPE_SECRET_KEY?.startsWith('sk_'));

    if (!process.env.STRIPE_SECRET_KEY) {
      console.log('❌ Stripe not configured - STRIPE_SECRET_KEY missing');
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get price ID for teams plan (assuming EUR for now)
    const currency = 'EUR';
    const priceIds = {
      teams: {
        monthly: 'price_1RwN7VH6gWxKcaTXHVkwwT60', // EUR monthly
        yearly: 'price_1RwN8hH6gWxKcaTXEaGbVvhz'   // EUR yearly
      }
    };

    const priceId = priceIds.teams[billing_frequency];
    if (!priceId) {
      console.log('❌ Invalid billing frequency:', billing_frequency);
      return res.status(400).json({ error: 'Invalid billing frequency' });
    }

    console.log('Using priceId:', priceId, 'for plan:', plan_type, 'billing:', billing_frequency, 'seats:', seats_total);

    // Validate price exists in Stripe
    try {
      const priceData = await stripe.prices.retrieve(priceId);
      console.log('✅ Price retrieved successfully:', priceData.id);
    } catch (priceError) {
      console.error('❌ Error retrieving price:', priceError);
      return res.status(400).json({ error: 'Invalid price configuration' });
    }

    // Create or find Stripe customer for organization
    let customer;
    try {
      // For organizations, we might want to create customer linked to org
      // For now, use the admin user's email
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('email')
        .eq('clerk_id', authResult.userId)
        .single();

      console.log('User data fetch result:', { userData, fetchError });

      let customerEmail;
      if (!fetchError && userData?.email) {
        customerEmail = userData.email;
        console.log('Using email from Supabase:', customerEmail);
      }

      // Try to find existing customer
      const customers = await stripe.customers.list({ limit: 100 });
      customer = customers.data.find((c) => c.metadata?.clerk_org_id === clerk_org_id);

      if (!customer) {
        console.log('Creating new customer for organization');
        customer = await stripe.customers.create({
          email: customerEmail || undefined,
          description: `Organization: ${clerk_org_id}`,
          metadata: {
            clerk_org_id: clerk_org_id,
            created_by: authResult.userId
          }
        });
        console.log('✅ New customer created:', customer.id);
      } else {
        console.log('✅ Using existing customer:', customer.id);
      }
    } catch (error) {
      console.error('❌ Error creating/finding customer:', error);
      return res.status(500).json({ error: 'Failed to create customer' });
    }

    // Create checkout session
    const sessionData: Stripe.Checkout.SessionCreateParams = {
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: seats_total,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.origin || 'https://www.softcodes.ai'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || 'https://www.softcodes.ai'}/payment-cancelled`,
      metadata: {
        clerk_org_id: clerk_org_id,
        plan_type: plan_type,
        billing_frequency: billing_frequency,
        seats_total: seats_total.toString(),
        currency: currency,
        price_id: priceId,
        created_by: authResult.userId,
      },
      subscription_data: {
        metadata: {
          clerk_org_id: clerk_org_id,
          plan_type: plan_type,
          billing_frequency: billing_frequency,
          seats_total: seats_total.toString(),
          currency: currency,
        },
      },
    };

    console.log('Creating checkout session with data:', JSON.stringify(sessionData, null, 2));

    const session = await stripe.checkout.sessions.create(sessionData);
    console.log('✅ Checkout session created:', session.id, 'URL:', session.url);

    return res.status(200).json({
      success: true,
      checkout_url: session.url,
      message: 'Subscription creation initiated'
    });
  } catch (error: any) {
    console.error('❌ API: Exception in create-subscription endpoint:', error);

    if (error.message === 'Missing or invalid Authorization header') {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (error.message === 'User does not belong to this organization' ||
        error.message === 'User is not an organization admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}