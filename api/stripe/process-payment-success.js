// Vercel serverless function for processing payment success
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  console.log('=== STRIPE PROCESS PAYMENT SUCCESS API ROUTE ENTRY ===');
  
  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('Step 1: Parsing request body...');
    const { sessionId, clerkUserId, clerkOrgId } = req.body;
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

    const { plan_type, billing_frequency, seats = 1, type, org_id, quantity } = metadata;
    
    // Use clerkOrgId from request body if available, otherwise fallback to metadata
    const finalOrgId = clerkOrgId || org_id || metadata.clerk_org_id;

    // Handle additional seats purchase
    if (type === 'additional_seats') {
      console.log('Processing additional seats purchase...');
      if (!org_id || !quantity) {
        return res.status(400).json({ error: 'Missing org_id or quantity for additional seats' });
      }

      // Update organization seats_total
      try {
        const { data: orgSub, error: fetchError } = await supabase
          .from('organization_subscriptions')
          .select('seats_total, stripe_subscription_id')
          .eq('clerk_org_id', org_id)
          .eq('status', 'active')
          .single();

        if (fetchError || !orgSub) {
          return res.status(404).json({ error: 'Organization subscription not found' });
        }

        const newSeatsTotal = orgSub.seats_total + parseInt(quantity);

        const { error: updateError } = await supabase
          .from('organization_subscriptions')
          .update({ seats_total: newSeatsTotal, updated_at: new Date().toISOString() })
          .eq('clerk_org_id', org_id);

        if (updateError) throw updateError;

        // Update Stripe subscription quantity if exists
        if (orgSub.stripe_subscription_id) {
          await stripe.subscriptions.update(orgSub.stripe_subscription_id, {
            quantity: newSeatsTotal,
            proration_behavior: 'create_prorations',
          });
        }

        console.log(`✅ Organization seats updated: ${orgSub.seats_total} -> ${newSeatsTotal}`);

        return res.status(200).json({
          success: true,
          message: 'Additional seats purchased successfully',
          data: {
            seatsAdded: parseInt(quantity),
            newTotalSeats: newSeatsTotal,
          }
        });
      } catch (error) {
        console.error('❌ Error processing additional seats:', error);
        return res.status(500).json({ error: 'Failed to process additional seats' });
      }
    }

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
    
    let totalCredits = 0;
    
    if (plan_type === 'teams' && finalOrgId) {
      console.log('🏢 Processing Teams plan for organization:', finalOrgId);
      
      // Ensure organization exists
      const { data: existingOrg, error: orgCheckError } = await supabase
        .from('organizations')
        .select('id, total_credits')
        .eq('clerk_org_id', finalOrgId)
        .maybeSingle();
        
      let organizationId = existingOrg?.id;
      
      if (!existingOrg) {
        console.log('Creating organization record for:', finalOrgId);
        const orgName = metadata.organization_name || `Organization ${finalOrgId.slice(-8)}`;
        
        const { data: newOrg, error: orgError } = await supabase
          .rpc('upsert_organization', {
            p_clerk_org_id: finalOrgId,
            p_name: orgName
          });
          
        if (orgError) {
          console.error('Failed to create organization:', orgError);
          // Try direct insert as fallback
          const { data: insertedOrg, error: insertError } = await supabase
            .from('organizations')
            .insert({
              clerk_org_id: finalOrgId,
              name: orgName
            })
            .select('id')
            .single();
            
          if (insertError) throw insertError;
          organizationId = insertedOrg.id;
        } else {
          const { data: org } = await supabase
            .from('organizations')
            .select('id')
            .eq('clerk_org_id', finalOrgId)
            .single();
          organizationId = org?.id;
        }
      }
      
      // Create organization subscription
      try {
        const subscriptionData = {
          clerk_org_id: finalOrgId,
          organization_id: organizationId,
          stripe_subscription_id: session.subscription?.id,
          stripe_customer_id: session.customer,
          plan_type,
          billing_frequency,
          seats_total: parseInt(seats) || 1,
          seats_used: 0,
          status: 'active',
          updated_at: new Date().toISOString()
        };
        
        const { error: subError } = await supabase
          .from('organization_subscriptions')
          .upsert(subscriptionData, { onConflict: 'clerk_org_id' });
          
        if (subError) throw subError;
        console.log('✅ Organization subscription record created');
      } catch (error) {
        console.error('❌ Error creating organization subscription:', error);
        return res.status(500).json({ error: 'Failed to create organization subscription' });
      }
      
      // Grant organization credits
      try {
        let baseCredits = 1000;
        if (billing_frequency === 'yearly') {
          baseCredits *= 12;
        }
        totalCredits = baseCredits * (parseInt(seats) || 1);
        
        const { data: orgData } = await supabase
          .from('organizations')
          .select('total_credits')
          .eq('clerk_org_id', finalOrgId)
          .single();
          
        const newCredits = (orgData?.total_credits || 0) + totalCredits;
        
        const { error: creditError } = await supabase
          .from('organizations')
          .update({
            total_credits: newCredits,
            updated_at: new Date().toISOString()
          })
          .eq('clerk_org_id', finalOrgId);
          
        if (creditError) throw creditError;
        
        // Record credit transaction
        const { error: transactionError } = await supabase
          .from('organization_credit_transactions')
          .insert({
            organization_id: organizationId,
            amount: totalCredits,
            description: `Initial ${plan_type} plan ${billing_frequency} credits (${seats || 1} seat${(seats || 1) > 1 ? 's' : ''})`,
            transaction_type: 'recurring',
            reference_id: session.subscription?.id
          });
          
        if (transactionError) {
          console.error('Failed to record org credit transaction:', transactionError);
        }
        
        console.log('✅ Organization credits granted:', totalCredits);
      } catch (error) {
        console.error('❌ Error granting organization credits:', error);
        return res.status(500).json({ error: 'Failed to grant organization credits' });
      }
      
    } else {
      // Create regular subscription record
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
        let baseCredits = 500;
        if (plan_type === 'teams') {
          baseCredits = 1000;
        }
        
        if (billing_frequency === 'yearly') {
          baseCredits *= 12;
        }
        
        totalCredits = baseCredits * (parseInt(seats) || 1);
        
        // Get user ID first
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, credits')
          .eq('clerk_id', clerkUserId)
          .single();

        if (userError || !userData) {
          throw new Error(`User not found for clerk_id: ${clerkUserId}`);
        }

        const userId = userData.id;
        const newCredits = (userData.credits || 0) + totalCredits;
        
        // Update credits directly
        const { error: creditError } = await supabase
          .from('users')
          .update({
            credits: newCredits,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (creditError) throw creditError;

        // Record credit transaction
        const { error: transactionError } = await supabase
          .from('credit_transactions')
          .insert({
            user_id: userId,
            amount: totalCredits,
            description: `${plan_type} plan ${billing_frequency} credits (${seats || 1} seat${(seats || 1) > 1 ? 's' : ''})`,
            transaction_type: 'purchase',
            reference_id: session.subscription?.id
          });

        if (transactionError) {
          console.error('Failed to record credit transaction:', transactionError);
          // Don't fail the process if transaction recording fails
        }

        console.log('✅ Credits granted:', totalCredits);
      } catch (error) {
        console.error('❌ Error granting credits:', error);
        return res.status(500).json({ error: 'Failed to grant credits' });
      }
    }

    const response = {
      success: true,
      message: 'Payment processed successfully',
      data: {
        planType: plan_type,
        billingFrequency: billing_frequency,
        seats: parseInt(seats) || 1,
        creditsGranted: totalCredits
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