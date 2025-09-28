// Vercel serverless function for handling Stripe webhooks
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  console.log('=== STRIPE WEBHOOKS API ROUTE ENTRY ===');
  
  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('Step 1: Verifying webhook signature...');
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.log('❌ Webhook secret not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      console.log('✅ Webhook signature verified');
    } catch (err) {
      console.log('❌ Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    console.log('Step 2: Processing webhook event:', event.type);

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      console.error('❌ No Supabase URL found in environment variables');
      return res.status(500).json({
        error: 'Webhook processing failed',
        details: 'supabaseUrl is required.'
      });
    }

    if (!supabaseKey) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
      return res.status(500).json({
        error: 'Webhook processing failed',
        details: 'supabaseKey is required.'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    switch (event.type) {
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object, supabase);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object, supabase);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object, supabase);
        break;

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object, supabase);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object, supabase);
        break;

      case 'payment_intent.created':
        await handlePaymentIntentCreated(event.data.object, supabase);
        break;

      case 'charge.succeeded':
        await handleChargeSucceeded(event.data.object, supabase);
        break;

      case 'charge.updated':
        await handleChargeUpdated(event.data.object, supabase);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, supabase);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, supabase);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    console.log('✅ Webhook processed successfully');
    res.json({ received: true });

  } catch (error) {
    console.error('❌ FATAL ERROR in webhooks:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error.message 
    });
  }
}

// Handle recurring subscription payments
async function handleInvoicePaymentSucceeded(invoice, supabase) {
  console.log('🔄 Processing invoice payment succeeded:', invoice.id);
  
  try {
    // Skip if this is not a subscription invoice
    if (!invoice.subscription) {
      console.log('Skipping non-subscription invoice');
      return;
    }

    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription, {
      expand: ['customer']
    });

    // Get user from Stripe customer
    const clerkUserId = await getUserFromStripeCustomer(subscription.customer, supabase);
    if (!clerkUserId) {
      console.log('❌ Could not find user for customer:', subscription.customer.id);
      return;
    }

    // Determine if this is initial or recurring payment
    const paymentType = await determinePaymentType(invoice, subscription);
    console.log('Payment type determined:', paymentType);

    // Skip initial payments as they're handled by checkout.session.completed
    if (paymentType === 'initial') {
      console.log('Skipping initial payment - handled by checkout flow');
      return;
    }

    // Check for idempotency to prevent duplicate processing
    const alreadyProcessed = await checkIdempotency(invoice.id, supabase);
    if (alreadyProcessed) {
      console.log('Invoice already processed, skipping');
      return;
    }

    // Calculate credits to grant
    const metadata = subscription.metadata || {};
    const planType = metadata.plan_type || 'pro';
    const billingFrequency = metadata.billing_frequency || (subscription.items.data[0]?.price?.recurring?.interval === 'year' ? 'yearly' : 'monthly');
    const seats = parseInt(metadata.seats || '1');

    const creditsToGrant = calculateCreditsToGrant(planType, billingFrequency, seats);
    
    console.log('Granting credits:', {
      clerkUserId,
      creditsToGrant,
      planType,
      billingFrequency,
      seats,
      invoiceId: invoice.id
    });

    // Grant credits
    const { error: creditError } = await supabase.rpc('grant_credits', {
      p_clerk_id: clerkUserId,
      p_amount: creditsToGrant,
      p_description: `${planType} plan ${billingFrequency} recurring credits (${seats} seat${seats > 1 ? 's' : ''})`,
      p_reference_id: invoice.id,
    });

    if (creditError) {
      throw new Error(`Failed to grant credits: ${creditError.message}`);
    }

    // Record webhook processing to prevent duplicates
    await recordWebhookProcessing(invoice.id, 'invoice.payment_succeeded', {
      clerkUserId,
      creditsGranted: creditsToGrant,
      planType,
      billingFrequency,
      seats
    }, supabase);

    console.log('✅ Recurring payment processed successfully');

  } catch (error) {
    console.error('❌ Error processing invoice payment succeeded:', error);
    throw error;
  }
}

// Handle initial checkout completion (updated to grant correct credits for yearly)
async function handleCheckoutSessionCompleted(session, supabase) {
  console.log('🛒 Processing checkout session completed:', session.id);
  
  try {
    // This handles initial subscription setup
    // Credits are granted by the existing process-payment-success.js
    // We just need to record the webhook for completeness
    
    const metadata = session.metadata || {};
    if (session.subscription && session.subscription.metadata) {
      Object.assign(metadata, session.subscription.metadata);
    }

    await recordWebhookProcessing(session.id, 'checkout.session.completed', {
      sessionId: session.id,
      subscriptionId: session.subscription,
      metadata
    }, supabase);

    console.log('✅ Checkout session webhook recorded');

  } catch (error) {
    console.error('❌ Error processing checkout session completed:', error);
    throw error;
  }
}

// Handle subscription updates (plan changes, seat changes, quantity changes)
async function handleSubscriptionUpdated(subscription, supabase) {
  console.log('📝 Processing subscription updated:', subscription.id);
  
  try {
    // Get user from Stripe customer
    const clerkUserId = await getUserFromStripeCustomer(subscription.customer, supabase);
    if (!clerkUserId) {
      console.log('❌ Could not find user for customer:', subscription.customer.id);
      return;
    }

    // Calculate total quantity from subscription items
    const totalQuantity = subscription.items.data.reduce((total, item) => {
      return total + item.quantity;
    }, 0);

    // Get organization subscription details
    const { data: orgSubscription, error: fetchError } = await supabase
      .from('organization_subscriptions')
      .select('*')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (fetchError) {
      console.error('Error fetching organization subscription:', fetchError);
      // Fall back to regular subscription update
      await updateRegularSubscription(subscription, supabase);
      return;
    }

    // Only process teams plans for seat synchronization
    if (orgSubscription.plan_type !== 'teams') {
      console.log('Skipping subscription update - not a teams plan, plan_type:', orgSubscription.plan_type);
      return;
    }

    // Update organization subscription with new seats_total
    const { error: updateError } = await supabase
      .from('organization_subscriptions')
      .update({
        seats_total: totalQuantity,
        status: subscription.status,
        updated_at: new Date().toISOString(),
        // Reset overage seats if seats_total increased
        overage_seats: orgSubscription.overage_seats > 0 ?
          Math.max(0, orgSubscription.overage_seats - (totalQuantity - orgSubscription.seats_total)) :
          orgSubscription.overage_seats
      })
      .eq('stripe_subscription_id', subscription.id);

    if (updateError) {
      console.error('Error updating organization subscription:', updateError);
    }

    // Also update regular subscription table for backward compatibility
    await updateRegularSubscription(subscription, supabase);

    await recordWebhookProcessing(subscription.id, 'customer.subscription.updated', {
      clerkUserId,
      status: subscription.status,
      seats_total: totalQuantity,
      organization_id: orgSubscription.organization_id
    }, supabase);

    console.log('✅ Subscription update processed with quantity:', totalQuantity);

  } catch (error) {
    console.error('❌ Error processing subscription updated:', error);
    throw error;
  }
}

// Helper function to update regular subscription table
async function updateRegularSubscription(subscription, supabase) {
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id);

  if (updateError) {
    console.error('Error updating regular subscription:', updateError);
  }
}
// Handle successful invoice payment (specifically for overage charges)
async function handleInvoicePaid(invoice, supabase) {
  console.log('💰 Processing invoice paid:', invoice.id);
  
  try {
    // Skip if this is not a subscription invoice
    if (!invoice.subscription) {
      console.log('Skipping non-subscription invoice');
      return;
    }

    // Get organization subscription
    const { data: orgSubscription, error: fetchError } = await supabase
      .from('organization_subscriptions')
      .select('*')
      .eq('stripe_subscription_id', invoice.subscription)
      .single();

    if (fetchError) {
      console.log('Organization subscription not found, skipping overage processing');
      return;
    }

    // Check if this invoice contains overage charges
    const hasOverageCharges = invoice.lines.data.some(line => 
      line.description?.includes('overage') || line.metadata?.is_overage === 'true'
    );

    if (hasOverageCharges && orgSubscription.overage_seats > 0) {
      console.log('Clearing overage seats after successful payment:', orgSubscription.overage_seats);
      
      // Clear overage seats
      const { error: updateError } = await supabase
        .from('organization_subscriptions')
        .update({
          overage_seats: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', orgSubscription.id);

      if (updateError) {
        console.error('Error clearing overage seats:', updateError);
      } else {
        console.log('✅ Overage seats cleared successfully');
      }
    }

    await recordWebhookProcessing(invoice.id, 'invoice.paid', {
      subscription_id: invoice.subscription,
      organization_id: orgSubscription.organization_id,
      had_overage_charges: hasOverageCharges,
      overage_seats_cleared: hasOverageCharges ? orgSubscription.overage_seats : 0
    }, supabase);

  } catch (error) {
    console.error('❌ Error processing invoice paid:', error);
    throw error;
  }
}

// Handle failed invoice payment
async function handleInvoicePaymentFailed(invoice, supabase) {
  console.log('❌ Processing invoice payment failed:', invoice.id);
  
  try {
    // Skip if this is not a subscription invoice
    if (!invoice.subscription) {
      console.log('Skipping non-subscription invoice');
      return;
    }

    // Get organization subscription
    const { data: orgSubscription, error: fetchError } = await supabase
      .from('organization_subscriptions')
      .select('*')
      .eq('stripe_subscription_id', invoice.subscription)
      .single();

    if (fetchError) {
      console.log('Organization subscription not found, skipping status update');
      return;
    }

    // Update subscription status to past_due
    const { error: updateError } = await supabase
      .from('organization_subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('id', orgSubscription.id);

    if (updateError) {
      console.error('Error updating subscription status:', updateError);
    }

    await recordWebhookProcessing(invoice.id, 'invoice.payment_failed', {
      subscription_id: invoice.subscription,
      organization_id: orgSubscription.organization_id,
      new_status: 'past_due'
    }, supabase);

    console.log('✅ Subscription status updated to past_due');

  } catch (error) {
    console.error('❌ Error processing invoice payment failed:', error);
    throw error;
  }
}

// Handle subscription cancellation
async function handleSubscriptionDeleted(subscription, supabase) {
  console.log('🗑️ Processing subscription deleted:', subscription.id);

  try {
    // Get user from Stripe customer
    const clerkUserId = await getUserFromStripeCustomer(subscription.customer, supabase);
    if (!clerkUserId) {
      console.log('❌ Could not find user for customer:', subscription.customer.id);
      return;
    }

    // Update subscription status in database
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    if (updateError) {
      console.error('Error updating subscription status:', updateError);
    }

    // Update user plan to starter
    const { error: userError } = await supabase
      .from('users')
      .update({
        plan_type: 'starter',
        updated_at: new Date().toISOString()
      })
      .eq('clerk_id', clerkUserId);

    if (userError) {
      console.error('Error updating user plan:', userError);
    }

    await recordWebhookProcessing(subscription.id, 'customer.subscription.deleted', {
      clerkUserId
    }, supabase);

    console.log('✅ Subscription cancellation processed');

  } catch (error) {
    console.error('❌ Error processing subscription deleted:', error);
    throw error;
  }
}

// Handle credit purchase payment success
async function handlePaymentIntentSucceeded(paymentIntent, supabase) {
  console.log('💰 Processing payment intent succeeded:', paymentIntent.id);

  try {
    // Get user from Stripe customer
    const clerkUserId = await getUserFromStripeCustomer(paymentIntent.customer, supabase);
    if (!clerkUserId) {
      console.log('❌ Could not find user for customer:', paymentIntent.customer);
      return;
    }

    // Check if this is a credit purchase by looking at metadata
    const metadata = paymentIntent.metadata || {};
    if (metadata.purchase_type !== 'credit_purchase') {
      console.log('Skipping non-credit purchase payment');
      return;
    }

    // Check for idempotency to prevent duplicate processing
    const alreadyProcessed = await checkIdempotency(paymentIntent.id, supabase);
    if (alreadyProcessed) {
      console.log('Payment intent already processed, skipping');
      return;
    }

    const credits = parseInt(metadata.credits || '0');
    if (credits <= 0) {
      console.log('❌ Invalid credits amount in metadata');
      return;
    }

    console.log('Granting credits:', {
      clerkUserId,
      credits,
      paymentIntentId: paymentIntent.id
    });

    // Grant credits to user
    const { error: creditError } = await supabase.rpc('grant_credits', {
      p_clerk_id: clerkUserId,
      p_amount: credits,
      p_description: `Credit purchase: ${credits} credits`,
      p_reference_id: paymentIntent.id,
    });

    if (creditError) {
      throw new Error(`Failed to grant credits: ${creditError.message}`);
    }

    // Record webhook processing to prevent duplicates
    await recordWebhookProcessing(paymentIntent.id, 'payment_intent.succeeded', {
      clerkUserId,
      creditsGranted: credits,
      purchaseType: 'credit_purchase'
    }, supabase);

    console.log('✅ Credit purchase processed successfully');

  } catch (error) {
    console.error('❌ Error processing payment intent succeeded:', error);
    throw error;
  }
}

// Helper function to get Clerk user ID from Stripe customer
async function getUserFromStripeCustomer(customer, supabase) {
  try {
    // If customer is just an ID, retrieve the full object
    let customerObj = customer;
    if (typeof customer === 'string') {
      customerObj = await stripe.customers.retrieve(customer);
    }

    // First try to get from customer metadata
    if (customerObj.metadata && customerObj.metadata.clerk_user_id) {
      return customerObj.metadata.clerk_user_id;
    }

    // Fallback: search in database by stripe_customer_id
    const { data: userData, error } = await supabase
      .from('users')
      .select('clerk_id')
      .eq('stripe_customer_id', customerObj.id)
      .single();

    if (error || !userData) {
      console.log('User not found for Stripe customer:', customerObj.id);
      return null;
    }

    return userData.clerk_id;

  } catch (error) {
    console.error('Error getting user from Stripe customer:', error);
    return null;
  }
}

// Helper function to determine if payment is initial or recurring
async function determinePaymentType(invoice, subscription) {
  try {
    // Get all invoices for this subscription
    const invoices = await stripe.invoices.list({
      subscription: subscription.id,
      limit: 10
    });

    // Sort by creation date
    const sortedInvoices = invoices.data.sort((a, b) => a.created - b.created);
    
    // If this is the first invoice, it's initial
    if (sortedInvoices.length === 1 && sortedInvoices[0].id === invoice.id) {
      return 'initial';
    }

    // If this is the first successful payment, it's initial
    const successfulInvoices = sortedInvoices.filter(inv => inv.status === 'paid');
    if (successfulInvoices.length === 1 && successfulInvoices[0].id === invoice.id) {
      return 'initial';
    }

    return 'recurring';

  } catch (error) {
    console.error('Error determining payment type:', error);
    // Default to recurring to be safe
    return 'recurring';
  }
}

// Helper function to calculate credits based on plan and billing frequency
function calculateCreditsToGrant(planType, billingFrequency, seats = 1) {
  const baseCredits = billingFrequency === 'yearly' ? 6000 : 500;
  return baseCredits * seats;
}

// Helper function to check if webhook event was already processed
async function checkIdempotency(eventId, supabase) {
  try {
    const { data, error } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .eq('status', 'success')
      .single();

    return !error && data;
  } catch (error) {
    // If table doesn't exist or error occurs, assume not processed
    return false;
  }
}

// Handle payment intent created event
async function handlePaymentIntentCreated(paymentIntent, supabase) {
  console.log('💳 Processing payment intent created:', paymentIntent.id);
  // Log the event but no action needed for creation
  await recordWebhookProcessing(paymentIntent.id, 'payment_intent.created', {
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: paymentIntent.status
  }, supabase);
  console.log('✅ Payment intent created event logged');
}

// Handle charge succeeded event
async function handleChargeSucceeded(charge, supabase) {
  console.log('💳 Processing charge succeeded:', charge.id);
  // Log the event but no action needed as payment_intent.succeeded handles credits
  await recordWebhookProcessing(charge.id, 'charge.succeeded', {
    amount: charge.amount,
    currency: charge.currency,
    payment_intent: charge.payment_intent
  }, supabase);
  console.log('✅ Charge succeeded event logged');
}

// Handle charge updated event
async function handleChargeUpdated(charge, supabase) {
  console.log('💳 Processing charge updated:', charge.id);
  // Log the event but no action needed typically
  await recordWebhookProcessing(charge.id, 'charge.updated', {
    amount: charge.amount,
    currency: charge.currency,
    status: charge.status,
    payment_intent: charge.payment_intent
  }, supabase);
  console.log('✅ Charge updated event logged');
}

// Helper function to record webhook processing
async function recordWebhookProcessing(eventId, eventType, payload, supabase) {
  try {
    const { error } = await supabase
      .from('webhook_events')
      .upsert({
        event_id: eventId,
        event_type: eventType,
        status: 'success',
        payload: payload,
        processed_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error recording webhook processing:', error);
    }
  } catch (error) {
    // Don't fail webhook processing if logging fails
    console.error('Error recording webhook processing:', error);
  }
}