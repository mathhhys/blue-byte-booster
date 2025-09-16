// Organization billing routes
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get organization subscription
router.get('/subscription', async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    console.log('Getting subscription for org:', orgId);

    // Get organization subscription from database
    const { data: subscription, error } = await supabase
      .from('organization_subscriptions')
      .select(`
        *,
        organizations (
          name,
          stripe_customer_id
        )
      `)
      .eq('clerk_org_id', orgId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!subscription) {
      return res.json({
        hasSubscription: false,
        subscription: null
      });
    }

    // Get seat count
    const { count: seatsUsed } = await supabase
      .from('organization_seats')
      .select('*', { count: 'exact', head: true })
      .eq('organization_subscription_id', subscription.id);

    res.json({
      hasSubscription: true,
      subscription: {
        ...subscription,
        seats_used: seatsUsed || 0
      }
    });

  } catch (error) {
    console.error('Error getting organization subscription:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// Create organization subscription
router.post('/create-subscription', async (req, res) => {
  try {
    const { clerk_org_id, plan_type, billing_frequency, seats_total, org_name } = req.body;

    if (!clerk_org_id || !plan_type || !billing_frequency || !seats_total) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Creating subscription for org:', clerk_org_id);

    // First, ensure organization exists in our database
    const { data: org, error: orgError } = await supabase.rpc('upsert_organization', {
      p_clerk_org_id: clerk_org_id,
      p_name: org_name
    });

    if (orgError) {
      console.error('Error upserting organization:', orgError);
      return res.status(500).json({ error: 'Failed to create organization record' });
    }

    // Get price ID based on plan and billing frequency
    const priceIds = {
      teams: {
        monthly: 'price_1RwNazH6gWxKcaTXi3OmXp4u', // Use your actual Stripe price IDs
        yearly: 'price_1RwNazH6gWxKcaTXi3OmXp4u'   // Update with yearly price ID
      }
    };

    const priceId = priceIds[plan_type]?.[billing_frequency];
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan or billing frequency' });
    }

    // Create Stripe customer for the organization
    const customer = await stripe.customers.create({
      name: org_name || `Organization ${clerk_org_id}`,
      metadata: {
        clerk_org_id: clerk_org_id,
        type: 'organization'
      }
    });

    // Update organization with Stripe customer ID
    await supabase
      .from('organizations')
      .update({ stripe_customer_id: customer.id })
      .eq('clerk_org_id', clerk_org_id);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: seats_total,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.origin || 'https://www.softcodes.ai'}/organizations/${clerk_org_id}/billing?success=true`,
      cancel_url: `${req.headers.origin || 'https://www.softcodes.ai'}/organizations/${clerk_org_id}/billing?canceled=true`,
      metadata: {
        clerk_org_id: clerk_org_id,
        plan_type: plan_type,
        billing_frequency: billing_frequency,
        seats_total: seats_total.toString(),
        type: 'organization'
      },
      subscription_data: {
        metadata: {
          clerk_org_id: clerk_org_id,
          plan_type: plan_type,
          billing_frequency: billing_frequency,
          seats_total: seats_total.toString(),
          type: 'organization'
        }
      }
    });

    res.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id
    });

  } catch (error) {
    console.error('Error creating organization subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Create organization billing portal session
router.post('/create-billing-portal', async (req, res) => {
  try {
    const { clerk_org_id } = req.body;

    if (!clerk_org_id) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    console.log('Creating billing portal for org:', clerk_org_id);

    // Get organization and its Stripe customer ID
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('stripe_customer_id, name')
      .eq('clerk_org_id', clerk_org_id)
      .single();

    if (orgError || !org) {
      console.error('Organization not found:', orgError);
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!org.stripe_customer_id) {
      return res.status(400).json({ error: 'Organization has no Stripe customer' });
    }

    // Create billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${req.headers.origin || 'https://www.softcodes.ai'}/organizations/${clerk_org_id}/billing`,
    });

    res.json({
      success: true,
      url: portalSession.url
    });

  } catch (error) {
    console.error('Error creating billing portal session:', error);
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});

// Assign seat to user
router.post('/assign-seat', async (req, res) => {
  try {
    const { clerk_org_id, clerk_user_id, user_email, user_name, assigned_by } = req.body;

    if (!clerk_org_id || !clerk_user_id || !user_email) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Assigning seat for user:', clerk_user_id, 'in org:', clerk_org_id);

    const { data: result, error } = await supabase.rpc('assign_organization_seat', {
      p_clerk_org_id: clerk_org_id,
      p_clerk_user_id: clerk_user_id,
      p_user_email: user_email,
      p_user_name: user_name,
      p_assigned_by: assigned_by
    });

    if (error) {
      console.error('Error assigning seat:', error);
      return res.status(500).json({ error: 'Failed to assign seat' });
    }

    if (!result) {
      return res.status(400).json({ error: 'No seats available or invalid organization' });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Error assigning seat:', error);
    res.status(500).json({ error: 'Failed to assign seat' });
  }
});

// Remove seat from user
router.post('/remove-seat', async (req, res) => {
  try {
    const { clerk_org_id, clerk_user_id } = req.body;

    if (!clerk_org_id || !clerk_user_id) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Removing seat for user:', clerk_user_id, 'from org:', clerk_org_id);

    const { data: result, error } = await supabase.rpc('remove_organization_seat', {
      p_clerk_org_id: clerk_org_id,
      p_clerk_user_id: clerk_user_id
    });

    if (error) {
      console.error('Error removing seat:', error);
      return res.status(500).json({ error: 'Failed to remove seat' });
    }

    if (!result) {
      return res.status(400).json({ error: 'Seat not found or invalid organization' });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Error removing seat:', error);
    res.status(500).json({ error: 'Failed to remove seat' });
  }
});

module.exports = router;