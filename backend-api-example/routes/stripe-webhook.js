const express = require('express');
const Stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Resend = require('resend').Resend;
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const router = express.Router();

// Stripe webhook endpoint
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = Stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({received: true});
  } catch (err) {
    console.error('Error processing webhook:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

async function handleSubscriptionCreated(subscription) {
  const { customer, id, trial_end } = subscription;

  if (!trial_end) return; // Not a trial

  try {
    const stripeCustomer = await Stripe.customers.retrieve(customer);
    const clerkUserId = stripeCustomer.metadata.clerkUserId;

    if (!clerkUserId) return;

    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('clerk_id', clerkUserId)
      .single();

    if (!user) return;

    // Grant 200 trial credits
    await supabase.rpc('grant_credits', {
      p_clerk_id: clerkUserId,
      p_amount: 200,
      p_description: 'Pro trial start - 200 credits',
      p_transaction_type: 'trial_grant',
      p_reference_id: id,
    });

    // Update subscription
    await supabase
      .from('subscriptions')
      .upsert({
        stripe_subscription_id: id,
        user_id: user.id,
        plan_type: 'pro',
        status: 'active',
        current_period_end: new Date(trial_end * 1000).toISOString(),
      });

    // Send notifications
    await createInAppNotification(user.id, 'Pro Trial Started', 'Your 7-day Pro trial has begun with 200 credits. Upgrade to continue after trial.', 'trial_start');
    if (user.email) {
      await sendEmail(user.email, 'Welcome to Pro Trial', '<h1>Welcome to Softcodes Pro Trial!</h1><p>You\'ve started your 7-day trial with 200 credits. Enjoy unlimited features!</p><p><a href="https://softcodes.ai/pricing">Upgrade to Pro</a></p>');
    }

  } catch (error) {
    console.error('Error handling subscription creation:', error);
  }
}

// Handler for checkout session completed
async function handleCheckoutSessionCompleted(session) {
  const { customer, subscription, metadata } = session;
  const clerkUserId = metadata.clerkUserId;
  const plan = metadata.plan;
  const skipTrial = metadata.skipTrial === 'true';

  if (!clerkUserId || plan !== 'pro') return;

  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('clerk_id', clerkUserId)
      .single();

    if (!user) return;

    if (skipTrial) {
      // Direct paid: grant full 500 credits
      await supabase.rpc('grant_credits', {
        p_clerk_id: clerkUserId,
        p_amount: 500,
        p_description: 'Pro subscription - full credits',
        p_transaction_type: 'grant',
        p_reference_id: subscription || session.id,
      });

      // Set anniversary date
      await supabase
        .from('users')
        .update({ subscription_anniversary_date: new Date().toISOString() })
        .eq('clerk_id', clerkUserId);

      // Send notifications
      await createInAppNotification(user.id, 'Pro Subscription Activated', 'Your Pro subscription is active with 500 monthly credits.', 'upgrade');
      if (user.email) {
        await sendEmail(user.email, 'Pro Subscription Confirmed', '<h1>Pro Subscription Active!</h1><p>Your subscription is now active with 500 credits per month.</p><p>Welcome to unlimited coding assistance!</p>');
      }
    }

    // Update subscription in database
    await supabase
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        stripe_subscription_id: subscription,
        plan_type: plan,
        billing_frequency: metadata.billingFrequency,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: skipTrial ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

  } catch (error) {
    console.error('Error handling checkout completion:', error);
  }
}

// Handler for payment succeeded (monthly reset)
async function handlePaymentSucceeded(invoice) {
  const subscription = invoice.subscription;
  const customer = invoice.customer;

  if (!subscription || !customer) return;

  try {
    const stripeCustomer = await Stripe.customers.retrieve(customer);
    const clerkUserId = stripeCustomer.metadata.clerkUserId;

    if (!clerkUserId) return;

    const { data: user } = await supabase
      .from('users')
      .select('plan_type, subscription_anniversary_date')
      .eq('clerk_id', clerkUserId)
      .single();

    if (!user || user.plan_type !== 'pro') return;

    // Check if this is anniversary (monthly reset)
    const anniversary = user.subscription_anniversary_date;
    const now = new Date();
    const isAnniversary = anniversary && 
      now.getFullYear() === new Date(anniversary).getFullYear() &&
      now.getMonth() === new Date(anniversary).getMonth() &&
      now.getDate() === new Date(anniversary).getDate();

    if (isAnniversary) {
      await supabase.rpc('reset_monthly_credits', {
        p_clerk_id: clerkUserId,
        p_plan_credits: 500,
      });
    }

    // Update subscription period
    await supabase
      .from('subscriptions')
      .update({
        current_period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : now.toISOString(),
        current_period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
        status: 'active',
      })
      .eq('stripe_subscription_id', subscription);

  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

// Handler for payment failed
async function handlePaymentFailed(invoice) {
  const subscription = invoice.subscription;
  const customer = invoice.customer;

  if (!subscription || !customer) return;

  try {
    const stripeCustomer = await Stripe.customers.retrieve(customer);
    const clerkUserId = stripeCustomer.metadata.clerkUserId;

    if (!clerkUserId) return;

    await supabase
      .from('subscriptions')
      .update({ status: 'past_due' })
      .eq('stripe_subscription_id', subscription);

  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

// Handler for subscription updated (trial end)
async function handleSubscriptionUpdated(subscription) {
  const { id, customer, items, current_period_end, trial_end } = subscription;

  try {
    const stripeCustomer = await Stripe.customers.retrieve(customer);
    const clerkUserId = stripeCustomer.metadata.clerkUserId;

    if (!clerkUserId) return;

    const { data: user } = await supabase
      .from('users')
      .select('id, credits, email')
      .eq('clerk_id', clerkUserId)
      .single();

    if (!user) return;

    // Check if trial ended
    if (subscription.previous_attributes && subscription.previous_attributes.trial_end && !trial_end) {
      // Trial conversion: grant 300 bonus to reach 500
      const currentCredits = user.credits || 0;
      const bonus = 300;
      const total = 500;

      if (currentCredits < 200) {
        await supabase.rpc('grant_credits', {
          p_clerk_id: clerkUserId,
          p_amount: total,
          p_description: 'Pro trial conversion - full 500 credits',
          p_transaction_type: 'grant',
          p_reference_id: id,
        });
      } else {
        await supabase.rpc('grant_credits', {
          p_clerk_id: clerkUserId,
          p_amount: bonus,
          p_description: 'Pro trial conversion - 300 bonus credits',
          p_transaction_type: 'conversion_bonus',
          p_reference_id: id,
        });
      }

      // Set anniversary if not set
      const { data: currentUser } = await supabase
        .from('users')
        .select('subscription_anniversary_date')
        .eq('clerk_id', clerkUserId)
        .single();

      if (!currentUser.subscription_anniversary_date) {
        await supabase
          .from('users')
          .update({ subscription_anniversary_date: new Date().toISOString() })
          .eq('clerk_id', clerkUserId);
      }

      // Send notifications for trial end and upgrade
      await createInAppNotification(user.id, 'Trial Ended - Upgrade Required', 'Your Pro trial has ended. Upgrade to continue with full access.', 'trial_end');
      if (user.email) {
        await sendEmail(user.email, 'Pro Trial Ended', '<h1>Your Trial Has Ended</h1><p>Upgrade to Pro to continue enjoying unlimited features and 500 monthly credits.</p><p><a href="https://softcodes.ai/pricing">Upgrade Now</a></p>');
      }
    }

    await supabase
      .from('subscriptions')
      .upsert({
        stripe_subscription_id: id,
        user_id: user.id,
        plan_type: 'pro',
        status: subscription.status,
        current_period_end: current_period_end ? new Date(current_period_end * 1000).toISOString() : null,
      });

  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

// Handler for subscription deleted
async function handleSubscriptionDeleted(subscription) {
  const { id, customer } = subscription;

  try {
    const stripeCustomer = await Stripe.customers.retrieve(customer);
    const clerkUserId = stripeCustomer.metadata.clerkUserId;

    if (!clerkUserId) return;

    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('clerk_id', clerkUserId)
      .single();

    if (!user) return;

    await supabase
      .from('users')
      .update({ plan_type: 'starter' })
      .eq('clerk_id', clerkUserId);

    await supabase
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('stripe_subscription_id', id);

    // Send cancellation confirmation
    await createInAppNotification(user.id, 'Subscription Canceled', 'Your Pro subscription has been canceled. You can resubscribe anytime.', 'billing');
    if (user.email) {
      await sendEmail(user.email, 'Subscription Canceled', '<h1>Subscription Canceled</h1><p>Your Pro subscription has been canceled. You\'ve been downgraded to the Starter plan.</p><p><a href="https://softcodes.ai/pricing">Resubscribe to Pro</a></p>');
    }

  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
}

async function sendEmail(to, subject, html) {
  try {
    await resend.emails.send({
      from: 'no-reply@softcodes.ai',
      to: [to],
      subject,
      html,
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

async function createInAppNotification(userId, title, message, type) {
  try {
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
      });
    console.log(`In-app notification created for user ${userId}`);
  } catch (error) {
    console.error('Error creating in-app notification:', error);
  }
}

module.exports = router;