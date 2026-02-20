import { createClient } from '@supabase/supabase-js';
import { orgMemberMiddleware } from '../../src/utils/clerk/token-verification.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { org_id } = req.query;

  if (!org_id) {
    return res.status(400).json({ error: 'Organization ID is required' });
  }

  try {
    // Allow any member of the organization to view the credit balance
    const authResult = await orgMemberMiddleware(req, org_id);

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: organization, error } = await supabase
      .from('organizations')
      .select('total_credits, used_credits')
      .eq('clerk_org_id', org_id)
      .single();

    if (error) {
      // If no organization found, return 0 credits
      if (error.code === 'PGRST116') {
        return res.status(200).json({
          total_credits: 0,
          used_credits: 0,
          remaining_credits: 0
        });
      }
      console.error('Error fetching organization credits:', error);
      return res.status(500).json({ error: 'Failed to fetch credits' });
    }

    const total = organization.total_credits || 0;
    const used = organization.used_credits || 0;
    const remaining = Math.max(0, total - used);

    // Also fetch the individual user's credit usage
    const { data: memberData } = await supabase
      .from('organization_members')
      .select('used_credits')
      .eq('clerk_org_id', org_id)
      .eq('clerk_user_id', authResult.userId)
      .single();

    const user_used_credits = memberData?.used_credits || 0;

    return res.status(200).json({
      total_credits: total,
      used_credits: used,
      remaining_credits: remaining,
      user_used_credits: user_used_credits
    });

  } catch (error: any) {
    console.error('Error in credits API:', error);
    if (error.message?.includes('Missing or invalid Authorization header')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (error.message?.includes('User does not belong to this organization') || error.message?.includes('User is not an organization admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}