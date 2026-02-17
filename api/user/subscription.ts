// API endpoint to get personal subscription data for the current user
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
});

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: any, res: any) {
  console.log('=== USER SUBSCRIPTION API ENTRY ===');
  console.log('Method:', req.method);

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get clerk_user_id from query params or body
    const clerkUserId = req.query.clerkUserId || req.query.userId || req.body?.clerkUserId || req.body?.userId;

    if (!clerkUserId) {
      console.log('❌ Missing clerkUserId parameter');
      return res.status(400).json({ error: 'Clerk User ID is required' });
    }

    console.log('Fetching subscription for user:', clerkUserId);

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase configuration missing');
      return res.status(500).json({ error: 'Database configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // First, try to get subscription from our database
    console.log('Step 1: Checking local database for subscription...');
    const { data: localSubscription, error: localError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .in('status', ['active', 'trialing', 'past_due', 'incomplete'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (localError && localError.code !== 'PGRST116') {
      console.error('❌ Database error fetching local subscription:', localError);
    }

    if (localSubscription) {
      console.log('✅ Found subscription in local database:', localSubscription.id);
      
      // Get recent credit transactions
      const { data: transactions, error: transError } = await supabase
        .from('user_subscription_credit_transactions')
        .select('*')
        .eq('user_subscription_id', localSubscription.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (transError) {
        console.error('Error fetching transactions:', transError);
      }

      // Get user's stripe_customer_id from users table if not in subscription
      let stripeCustomerId = localSubscription.stripe_customer_id;
      if (!stripeCustomerId) {
        const { data: userData } = await supabase
          .from('users')
          .select('stripe_customer_id')
          .eq('clerk_id', clerkUserId)
          .single();
        
        if (userData?.stripe_customer_id) {
          stripeCustomerId = userData.stripe_customer_id;
        }
      }

      return res.status(200).json({
        success: true,
        hasSubscription: true,
        subscription: {
          id: localSubscription.id,
          planType: localSubscription.plan_type,
          billingFrequency: localSubscription.billing_frequency,
          status: localSubscription.status,
          totalCredits: localSubscription.total_credits,
          usedCredits: localSubscription.used_credits,
          availableCredits: localSubscription.total_credits - localSubscription.used_credits,
          stripeCustomerId: stripeCustomerId,
          stripeSubscriptionId: localSubscription.stripe_subscription_id,
          currentPeriodStart: localSubscription.current_period_start,
          currentPeriodEnd: localSubscription.current_period_end,
          lastCreditRechargeAt: localSubscription.last_credit_recharge_at,
          createdAt: localSubscription.created_at,
          updatedAt: localSubscription.updated_at,
        },
        transactions: transactions || [],
        source: 'local'
      });
    }

    console.log('No local subscription found, checking Stripe...');

    // If no local subscription, try to find in Stripe
    // First, get the user's email from our database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, stripe_customer_id')
      .eq('clerk_id', clerkUserId)
      .single();

    if (userError) {
      console.error('❌ Error fetching user data:', userError);
    }

    let stripeCustomerId = userData?.stripe_customer_id;

    // If no stripe_customer_id stored, try to find by email
    if (!stripeCustomerId && userData?.email) {
      console.log('Searching Stripe for customer by email:', userData.email);
      const customers = await stripe.customers.list({
        email: userData.email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
        console.log('✅ Found Stripe customer by email:', stripeCustomerId);

        // Update user record with stripe_customer_id
        await supabase
          .from('users')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('clerk_id', clerkUserId);
      }
    }

    // If we have a stripe customer ID, fetch their subscriptions
    if (stripeCustomerId) {
      console.log('🔍 DEBUG: Fetching Stripe subscriptions for customer:', stripeCustomerId);
      
      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'active', // Prioritize active subscriptions
        limit: 10,
        expand: ['data.default_payment_method', 'data.latest_invoice', 'data.items.data.price.product'],
      });

      if (subscriptions.data.length > 0) {
        // Get the most recent active subscription
        const activeSub = subscriptions.data.find(
          sub => ['active', 'trialing', 'past_due'].includes(sub.status)
        ) || subscriptions.data[0];

        console.log('✅ DEBUG: Found Stripe subscription:', activeSub.id);
        console.log('🔍 DEBUG: Subscription status:', activeSub.status);
        console.log('🔍 DEBUG: Subscription metadata:', activeSub.metadata);
        console.log('🔍 DEBUG: Subscription items product:', activeSub.items.data[0]?.price?.product);

        // Extract plan type from metadata or product
        let planType = activeSub.metadata?.plan_type;
        
        if (!planType) {
          const product = activeSub.items.data[0]?.price?.product;
          const productName = typeof product === 'string' ? product.toLowerCase() : '';
          
          if (productName.includes('pro')) {
            planType = 'pro';
          } else if (productName.includes('teams')) {
            planType = 'teams';
          } else if (productName.includes('enterprise')) {
            planType = 'enterprise';
          } else {
            planType = 'basic';
          }
        }
        
        console.log('🔍 DEBUG: Detected planType:', planType);

        // Extract billing frequency
        const billingFrequency = activeSub.items.data[0]?.price?.recurring?.interval === 'year' 
          ? 'yearly' 
          : 'monthly';

        // Create local subscription record
        const subscriptionData = {
          user_id: null as string | null, // Will be populated below
          clerk_user_id: clerkUserId,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: activeSub.id,
          plan_type: planType,
          billing_frequency: billingFrequency,
          status: activeSub.status,
          current_period_start: new Date((activeSub as any).current_period_start * 1000).toISOString(),
          current_period_end: new Date((activeSub as any).current_period_end * 1000).toISOString(),
        };

        // Get the user_id from users table
        const { data: userRecord } = await supabase
          .from('users')
          .select('id')
          .eq('clerk_id', clerkUserId)
          .single();

        if (userRecord) {
          subscriptionData.user_id = userRecord.id;

          // Insert the subscription record
          const { data: newSub, error: insertError } = await supabase
            .from('user_subscriptions')
            .upsert(subscriptionData, {
              onConflict: 'clerk_user_id',
              ignoreDuplicates: false,
            })
            .select()
            .single();

          if (insertError) {
            console.error('❌ Error creating local subscription record:', insertError);
          } else {
            console.log('✅ Created local subscription record:', newSub?.id);
          }
        }

        return res.status(200).json({
          success: true,
          hasSubscription: true,
          subscription: {
            id: activeSub.id,
            planType,
            billingFrequency,
            status: activeSub.status,
            totalCredits: 0, // Will be populated by credit system
            usedCredits: 0,
            availableCredits: 0,
            stripeCustomerId: stripeCustomerId,
            stripeSubscriptionId: activeSub.id,
            currentPeriodStart: subscriptionData.current_period_start,
            currentPeriodEnd: subscriptionData.current_period_end,
          },
          transactions: [],
          source: 'stripe'
        });
      } else {
        console.log('No Stripe subscriptions found for customer');
      }
    }

    // No subscription found anywhere
    console.log('No subscription found for user:', clerkUserId);
    return res.status(200).json({
      success: true,
      hasSubscription: false,
      subscription: null,
      transactions: [],
      message: 'No active subscription found',
    });

  } catch (error) {
    console.error('❌ FATAL ERROR in user subscription endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}