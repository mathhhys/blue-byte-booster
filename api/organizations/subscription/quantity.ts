import { organizationSubscriptionOperations } from '../../../src/utils/supabase/database.js';
import { orgAdminMiddleware } from '../../../src/utils/clerk/token-verification.js';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async function handler(req: any, res: any) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId, newQuantity } = req.body;

  if (!orgId || newQuantity === undefined || newQuantity === null) {
    return res.status(400).json({ error: 'Organization ID and new quantity are required' });
  }

  if (newQuantity < 1) {
    return res.status(400).json({ error: 'Quantity must be at least 1' });
  }

  try {
    // Verify organization admin access
    const authResult = await orgAdminMiddleware(req, orgId);
    console.log('🔍 API: Updating subscription quantity for organization:', orgId, 'by user:', authResult.userId, 'to:', newQuantity);

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // Get current subscription
    const { data: currentSub, error: fetchError } = await supabase
      .from('organization_subscriptions')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('clerk_org_id', orgId)
      .eq('status', 'active')
      .single();

    if (fetchError || !currentSub) {
      return res.status(404).json({ error: 'Active subscription not found' });
    }

    // Update Stripe Subscription
    console.log('Updating Stripe subscription:', currentSub.stripe_subscription_id, 'to quantity:', newQuantity);
    
    // Get subscription items to find the main item
    const stripeSub = await stripe.subscriptions.retrieve(currentSub.stripe_subscription_id);
    const itemId = stripeSub.items.data[0].id;

    await stripe.subscriptions.update(currentSub.stripe_subscription_id, {
      items: [{ id: itemId, quantity: newQuantity }],
      proration_behavior: 'always_invoice', // Charge immediately for upgrade
    });

    // We do NOT update the database here.
    // We let the Stripe Webhook (customer.subscription.updated) handle the database update.
    // This ensures that credits are granted correctly and the DB stays in sync with Stripe's proration logic.

    console.log('✅ API: Stripe subscription update initiated');
    return res.status(200).json({
      success: true,
      message: 'Subscription update initiated. Changes will reflect shortly.'
    });
  } catch (error: any) {
    console.error('❌ API: Exception:', error);
    
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