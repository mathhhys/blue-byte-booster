// Vercel serverless function for getting Kinde organization seats
import { createClient } from '@supabase/supabase-js';
import { kindeAuthMiddleware } from '../../../middleware/dual-auth.js';

export default async function handler(req, res) {
  console.log('=== KINDE SEATS API ROUTE ENTRY ===');

  // Only allow GET method
  if (req.method !== 'GET') {
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

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get subscription to know total seats
    const { data: subscription } = await supabase
      .from('kinde_organization_subscriptions')
      .select('seats_total')
      .eq('kinde_org_code', orgCode)
      .eq('status', 'active')
      .single();

    // Get all seats
    const { data: seats, error: seatsError } = await supabase
      .from('kinde_organization_seats')
      .select('*')
      .eq('kinde_org_code', orgCode)
      .order('assigned_at', { ascending: false });

    if (seatsError) {
      console.error('Error fetching seats:', seatsError);
      return res.status(500).json({ error: 'Failed to fetch seats' });
    }

    // Filter to only active seats for counting
    const activeSeats = seats?.filter(s => s.status === 'active') || [];

    return res.status(200).json({
      seats_total: subscription?.seats_total || 0,
      seats_used: activeSeats.length,
      seats: seats?.map(seat => ({
        user_id: seat.user_id,
        email: seat.email,
        status: seat.status,
        role: seat.role,
        assigned_at: seat.assigned_at,
      })) || [],
    });

  } catch (error) {
    console.error('Error in Kinde seats get:', error);
    return res.status(500).json({
      error: 'Failed to get seats',
      details: error.message,
    });
  }
}