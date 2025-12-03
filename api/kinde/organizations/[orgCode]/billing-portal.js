// Vercel serverless function for Kinde organization billing portal
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { kindeAuthMiddleware } from '../../../middleware/dual-auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  console.log('=== KINDE BILLING PORTAL API ROUTE ENTRY ===');

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate Kinde authentication
    const authResult = await kindeAuthMiddleware(req, res, null);
    if (!authResult) return;

    const { orgCode } = req.query;

    // Validate that user belongs to this organization
    if (req.auth.orgCode !== orgCode) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    // Check if user has admin role
    const isAdmin = req.auth.roles?.includes('admin') || req.auth.roles?.includes('org:admin');
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can access billing portal' });
    }

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get customer ID
    const { data: customer, error: custError } = await supabase
      .from('kinde_organization_customers')
      .select('stripe_customer_id')
      .eq('kinde_org_code', orgCode)
      .single();

    if (custError || !customer?.stripe_customer_id) {
      return res.status(404).json({ error: 'No billing information found for this organization' });
    }

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${req.headers.origin || 'https://www.softcodes.ai'}/teams/dashboard`,
    });

    return res.status(200).json({
      success: true,
      url: session.url,
    });

  } catch (error) {
    console.error('Error in Kinde billing portal:', error);
    return res.status(500).json({
      error: 'Failed to open billing portal',
      details: error.message,
    });
  }
}