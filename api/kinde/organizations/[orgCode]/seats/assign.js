// Vercel serverless function for assigning seats in Kinde organizations
import { createClient } from '@supabase/supabase-js';
import { kindeAuthMiddleware } from '../../../../middleware/dual-auth.js';

export default async function handler(req, res) {
  console.log('=== KINDE SEAT ASSIGN API ROUTE ENTRY ===');

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate Kinde authentication
    const authResult = await kindeAuthMiddleware(req, res, null);
    if (!authResult) return;

    const { orgCode } = req.query;
    const { email, role = 'member' } = req.body;

    // Validate that user belongs to this organization
    if (req.auth.orgCode !== orgCode) {
      return res.status(403).json({ error: 'You do not have access to this organization' });
    }

    // Check if user has admin role
    const isAdmin = req.auth.roles?.includes('admin') || req.auth.roles?.includes('org:admin');
    if (!isAdmin) {
      return res.status(403).json({ error: 'Only admins can assign seats' });
    }

    // Validate email
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get subscription to check available seats
    const { data: subscription, error: subError } = await supabase
      .from('kinde_organization_subscriptions')
      .select('seats_total')
      .eq('kinde_org_code', orgCode)
      .eq('status', 'active')
      .single();

    if (subError || !subscription) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Count currently used seats
    const { count: seatsUsed } = await supabase
      .from('kinde_organization_seats')
      .select('*', { count: 'exact', head: true })
      .eq('kinde_org_code', orgCode)
      .eq('status', 'active');

    // Check if there are available seats
    if (seatsUsed >= subscription.seats_total) {
      return res.status(402).json({ 
        error: 'No available seats',
        seats_total: subscription.seats_total,
        seats_used: seatsUsed,
        message: 'Please purchase additional seats to add more members'
      });
    }

    // Check if email is already assigned
    const { data: existingSeat } = await supabase
      .from('kinde_organization_seats')
      .select('*')
      .eq('kinde_org_code', orgCode)
      .eq('email', email.toLowerCase())
      .single();

    if (existingSeat && existingSeat.status === 'active') {
      return res.status(400).json({ error: 'This email already has an active seat' });
    }

    // Generate a unique user ID for the new member (they'll get the real one on sign up)
    const pendingUserId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create or update seat assignment
    const seatData = {
      kinde_org_code: orgCode,
      user_id: pendingUserId,
      email: email.toLowerCase(),
      role: role === 'admin' ? 'admin' : 'member',
      status: 'pending', // Will become 'active' when user accepts invite
      assigned_at: new Date().toISOString(),
      assigned_by: req.auth.userId,
    };

    let result;
    if (existingSeat) {
      // Reactivate existing seat
      const { data, error } = await supabase
        .from('kinde_organization_seats')
        .update({ ...seatData, id: existingSeat.id })
        .eq('id', existingSeat.id)
        .select()
        .single();
      result = { data, error };
    } else {
      // Create new seat
      const { data, error } = await supabase
        .from('kinde_organization_seats')
        .insert(seatData)
        .select()
        .single();
      result = { data, error };
    }

    if (result.error) {
      console.error('Error assigning seat:', result.error);
      return res.status(500).json({ error: 'Failed to assign seat' });
    }

    // TODO: Trigger Kinde invitation email via Management API
    // This would typically call Kinde's API to send an organization invite

    return res.status(200).json({
      success: true,
      message: `Seat assigned to ${email}`,
      seat: {
        user_id: result.data.user_id,
        email: result.data.email,
        role: result.data.role,
        status: result.data.status,
        assigned_at: result.data.assigned_at,
      },
    });

  } catch (error) {
    console.error('Error in Kinde seat assign:', error);
    return res.status(500).json({
      error: 'Failed to assign seat',
      details: error.message,
    });
  }
}