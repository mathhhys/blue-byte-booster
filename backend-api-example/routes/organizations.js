const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { authenticateClerkToken } = require('../middleware/auth');
const { rateLimitMiddleware } = require('../middleware/rateLimit');

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Helper to verify user is in organization (admin or member)
async function verifyUserInOrganization(clerkUserId, orgId) {
  const { data, error } = await supabase
    .from('organization_members')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .eq('organization_id', orgId)
    .single();

  return !error && !!data;
}

// GET /api/organizations/subscription?orgId=...
router.get('/subscription', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { orgId } = req.query;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const isMember = await verifyUserInOrganization(req.auth.clerkUserId, orgId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }

    const { data: subscription, error } = await supabase
      .from('organization_subscriptions')
      .select('id, clerk_org_id, plan_type, billing_frequency, seats_total, seats_used, status, stripe_subscription_id as id, current_period_start, current_period_end')
      .eq('clerk_org_id', orgId)
      .eq('status', 'active')
      .single();

    if (error || !subscription) {
      return res.json({
        hasSubscription: false,
        subscription: null,
      });
    }

    res.json({
      hasSubscription: true,
      subscription,
    });
  } catch (error) {
    console.error('Error fetching organization subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription data' });
  }
});

// GET /api/organizations/seats?org_id=...
router.get('/seats', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { org_id: orgId } = req.query;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const isMember = await verifyUserInOrganization(req.auth.clerkUserId, orgId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }

    let subscription = null;
    let subError = null;
    try {
      const { data, error } = await supabase
        .from('organization_subscriptions')
        .select('seats_used, seats_total')
        .eq('clerk_org_id', orgId)
        .eq('status', 'active')
        .maybeSingle();  // Use maybeSingle to avoid error on no row

      subscription = data;
      subError = error;
    } catch (subErr) {
      subError = subErr;
    }

    if (subError) {
      console.error('Subscription query error for orgId:', orgId, subError);
    }

    if (!subscription) {
      console.log('No active subscription for orgId:', orgId);
      return res.status(404).json({
        seats_used: 0,
        seats_total: 0,
        seats: [],
        error: 'No active subscription or organization not found'
      });
    }

    console.log('Fetched subscription for orgId:', orgId, 'Seats used/total:', subscription.seats_used, '/', subscription.seats_total);

    let seats = [];
    let seatsError = null;
    try {
      const { data, error } = await supabase
        .from('organization_seats')
        .select('clerk_user_id as user_id, user_email as email, status')
        .eq('clerk_org_id', orgId)
        .eq('status', 'active');

      seats = data || [];
      seatsError = error;
    } catch (queryErr) {
      seatsError = queryErr;
    }

    if (seatsError) {
      console.error('Seats query failed for orgId:', orgId);
      console.error('Error code:', seatsError.code);
      console.error('Error message:', seatsError.message);
      console.error('Error details:', seatsError.details);
      console.error('Full error:', seatsError);
      return res.status(500).json({ error: 'Failed to fetch seats' });
    }

    console.log('Fetched seats for orgId:', orgId, 'Count:', seats.length);

    res.json({
      seats_used: subscription.seats_used || 0,
      seats_total: subscription.seats_total || 0,
      seats,
    });
  } catch (error) {
    console.error('Error loading seats:', error);
    res.status(500).json({ error: 'Failed to fetch seats' });
  }
});

// POST /api/organizations/seats/assign
router.post('/seats/assign', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { org_id: orgId, email, role = 'member' } = req.body;
    if (!orgId || !email) {
      return res.status(400).json({ error: 'Organization ID and user email are required' });
    }

    const isMember = await verifyUserInOrganization(req.auth.clerkUserId, orgId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }

    // Check subscription
    const { data: subscription, error: subError } = await supabase
      .from('organization_subscriptions')
      .select('id, seats_used, seats_total, overage_seats')
      .eq('clerk_org_id', orgId)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    if (subscription.seats_used >= subscription.seats_total + (subscription.overage_seats || 0)) {
      return res.status(402).json({ error: 'No available seats. Upgrade your subscription.' });
    }

    // Check if user already has seat
    const { data: existingSeat } = await supabase
      .from('organization_seats')
      .select('id')
      .eq('clerk_org_id', orgId)
      .eq('user_email', email)
      .eq('status', 'active')
      .single();

    if (existingSeat) {
      return res.status(400).json({ error: 'User already has an active seat' });
    }

    // First, try to find the user by email to get their clerk_user_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('clerk_id')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      return res.status(400).json({ error: 'User not found. Please ensure the user has signed up for the service first.' });
    }

    const clerkUserId = userData.clerk_id;

    // Check if user already has seat
    const { data: existingSeatForUser } = await supabase
      .from('organization_seats')
      .select('id')
      .eq('clerk_org_id', orgId)
      .eq('clerk_user_id', clerkUserId)
      .eq('status', 'active')
      .single();

    if (existingSeatForUser) {
      return res.status(400).json({ error: 'User already has an active seat' });
    }

    // Assign seat with credit allocation using database function
    const { data: seatAssigned, error: assignError } = await supabase.rpc('assign_organization_seat_with_credits', {
      p_clerk_org_id: orgId,
      p_clerk_user_id: clerkUserId,
      p_user_email: email,
      p_user_name: null, // We don't have user name here
      p_assigned_by: req.auth.clerkUserId,
      p_expires_at: null
    });

    if (assignError || !seatAssigned) {
      console.error('Error assigning seat with credits:', assignError);
      return res.status(500).json({ error: 'Failed to assign seat with credits' });
    }

    // Get the created seat details
    const { data: seat, error: seatError } = await supabase
      .from('organization_seats')
      .select('*')
      .eq('clerk_org_id', orgId)
      .eq('clerk_user_id', clerkUserId)
      .eq('status', 'active')
      .single();

    if (seatError) {
      console.error('Error fetching seat details:', seatError);
      return res.status(500).json({ error: 'Seat assigned but failed to retrieve details' });
    }

    res.json({ success: true, seat });
  } catch (error) {
    console.error('Error assigning seat:', error);
    res.status(500).json({ error: 'Failed to assign seat' });
  }
});

// POST /api/organizations/seats/revoke
router.post('/seats/revoke', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { org_id: orgId, user_id: clerkUserId } = req.body;
    if (!orgId || !clerkUserId) {
      return res.status(400).json({ error: 'Organization ID and user ID required' });
    }

    const isMember = await verifyUserInOrganization(req.auth.clerkUserId, orgId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }

    // Revoke seat with credit deallocation using database function
    const { data: seatRevoked, error: revokeError } = await supabase.rpc('remove_organization_seat_with_credits', {
      p_clerk_org_id: orgId,
      p_clerk_user_id: clerkUserId
    });

    if (revokeError || !seatRevoked) {
      console.error('Error revoking seat with credits:', revokeError);
      return res.status(500).json({ error: 'Failed to revoke seat with credit deallocation' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking seat:', error);
    res.status(500).json({ error: 'Failed to revoke seat' });
  }
});

// POST /api/organizations/create-subscription
router.post('/create-subscription', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { clerk_org_id: orgId, plan_type, billing_frequency, seats_total } = req.body;
    if (!orgId || !plan_type || !billing_frequency || !seats_total) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Verify user in org
    const isMember = await verifyUserInOrganization(req.auth.clerkUserId, orgId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }

    // Price IDs for teams plan (update with actual Stripe prices)
    const priceIds = {
      monthly: 'price_1RwNazH6gWxKcaTXi3OmXp4u', // Example teams monthly
      yearly: 'price_1RwNazH6gWxKcaTXi3OmXp4v', // Example teams yearly
    };

    const priceId = priceIds[billing_frequency];
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid billing frequency' });
    }

    // Create or get customer
    let customer;
    const { data: existingCustomer } = await supabase
      .from('organization_subscriptions')
      .select('stripe_customer_id')
      .eq('clerk_org_id', orgId)
      .single();

    if (existingCustomer?.stripe_customer_id) {
      customer = { id: existingCustomer.stripe_customer_id };
    } else {
      customer = await stripe.customers.create({
        metadata: { clerk_org_id: orgId },
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: seats_total }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/organizations`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/organizations`,
      metadata: {
        clerk_org_id: orgId,
        plan_type,
        billing_frequency,
        seats_total: seats_total.toString(),
        type: 'organization',
      },
      subscription_data: {
        metadata: {
          clerk_org_id: orgId,
          plan_type,
          billing_frequency,
          seats_total: seats_total.toString(),
          type: 'organization',
        },
      },
    });

    res.json({ success: true, checkout_url: session.url });
  } catch (error) {
    console.error('Error creating organization subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// POST /api/organizations/create-billing-portal
router.post('/create-billing-portal', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { clerk_org_id: orgId } = req.body;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const isMember = await verifyUserInOrganization(req.auth.clerkUserId, orgId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }

    const { data: subscription, error: subError } = await supabase
      .from('organization_subscriptions')
      .select('stripe_customer_id')
      .eq('clerk_org_id', orgId)
      .eq('status', 'active')
      .single();

    if (subError || !subscription?.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/organizations`,
    });

    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error('Error creating billing portal:', error);
    res.status(500).json({ error: 'Failed to create billing portal' });
  }
});

// PUT /api/organizations/subscription/quantity
router.put('/subscription/quantity', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { org_id: orgId, quantity } = req.body;
    if (!orgId || typeof quantity !== 'number') {
      return res.status(400).json({ error: 'Organization ID and quantity required' });
    }

    const isMember = await verifyUserInOrganization(req.auth.clerkUserId, orgId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }

    const { data: subscription, error: subError } = await supabase
      .from('organization_subscriptions')
      .select('id, seats_total')
      .eq('clerk_org_id', orgId)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Update seats_total (this would typically trigger Stripe update; here just DB)
    const { error: updateError } = await supabase
      .from('organization_subscriptions')
      .update({
        seats_total: quantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    // In production, update Stripe subscription quantity via API

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating subscription quantity:', error);
    res.status(500).json({ error: 'Failed to update quantity' });
  }
});

module.exports = router;

// GET /api/organizations/credits?org_id=...
router.get('/credits', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { org_id: orgId } = req.query;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const isMember = await verifyUserInOrganization(req.auth.clerkUserId, orgId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }

    const { data, error } = await supabase
      .from('organization_subscriptions')
      .select('total_credits, used_credits, seats_total, seats_used, plan_type, billing_frequency')
      .eq('clerk_org_id', orgId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    res.json({
      total_credits: data.total_credits,
      used_credits: data.used_credits,
      remaining_credits: data.total_credits - data.used_credits,
      seats_total: data.seats_total,
      seats_used: data.seats_used,
      plan_type: data.plan_type,
      billing_frequency: data.billing_frequency,
    });
  } catch (error) {
    console.error('Error fetching organization credits:', error);
    res.status(500).json({ error: 'Failed to fetch organization credits' });
  }
});

// POST /api/organizations/credits/deduct
router.post('/credits/deduct', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { org_id: orgId, credits_amount } = req.body;
    if (!orgId || !credits_amount || credits_amount <= 0) {
      return res.status(400).json({ error: 'Organization ID and positive credits amount required' });
    }

    const isMember = await verifyUserInOrganization(req.auth.clerkUserId, orgId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }

    const { data, error } = await supabase.rpc('deduct_org_credits', {
      p_clerk_org_id: orgId,
      p_credits_amount: credits_amount
    });

    if (error || !data) {
      return res.status(400).json({ error: 'Insufficient credits or no active subscription' });
    }

    res.json({ success: true, remaining_credits: data.total_credits - data.used_credits });
  } catch (error) {
    console.error('Error deducting organization credits:', error);
    res.status(500).json({ error: 'Failed to deduct credits' });
  }
});

// POST /api/organizations/credits/topup
router.post('/credits/topup', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { org_id: orgId, credits_amount } = req.body;
    if (!orgId || !credits_amount || credits_amount <= 0) {
      return res.status(400).json({ error: 'Organization ID and positive credits amount required' });
    }

    const isMember = await verifyUserInOrganization(req.auth.clerkUserId, orgId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }

    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from('organization_subscriptions')
      .select('stripe_customer_id')
      .eq('clerk_org_id', orgId)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Calculate dollar amount (using same conversion as individual credits)
    const dollarAmount = Math.ceil(credits_amount * (7 / 500)); // $7 for 500 credits

    // Create Stripe checkout session for top-up
    const session = await stripe.checkout.sessions.create({
      customer: subscription.stripe_customer_id,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Organization Credit Top-up',
            description: `${credits_amount} credits for organization`,
          },
          unit_amount: dollarAmount * 100, // cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/organizations?topup_success=true`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/organizations?topup_cancelled=true`,
      metadata: {
        clerk_org_id: orgId,
        credits_amount: credits_amount.toString(),
        type: 'org_credit_topup',
      },
    });

    res.json({ success: true, checkout_url: session.url });
  } catch (error) {
    console.error('Error creating credit top-up session:', error);
    res.status(500).json({ error: 'Failed to create top-up session' });
  }
});

// Webhook handler for top-up payment success (add to stripe webhook if not present)
router.post('/credits/topup/webhook', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orgId = session.metadata.clerk_org_id;
      const creditsAmount = parseInt(session.metadata.credits_amount);

      if (session.metadata.type === 'org_credit_topup') {
        // Add credits to org pool
        await supabase.rpc('add_org_credits', {
          p_clerk_org_id: orgId,
          p_credits_amount: creditsAmount
        });

        console.log(`✅ Added ${creditsAmount} credits to org ${orgId}`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook error' });
  }
});