import { organizationSeatOperations } from '../../src/utils/supabase/database.js';
import { orgAdminMiddleware } from '../../src/utils/clerk/token-verification.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId, org_id } = req.query;
  
  console.log('🔍 DEBUG: Subscription endpoint - Received query parameters:', req.query);
  console.log('🔍 DEBUG: orgId param:', orgId);
  console.log('🔍 DEBUG: org_id param:', org_id);
  
  const finalOrgId = orgId || org_id;

  if (!finalOrgId) {
    console.log('❌ DEBUG: No organization ID found in query parameters');
    return res.status(400).json({ error: 'Organization ID is required (orgId or org_id)' });
  }
  
  console.log('✅ DEBUG: Getting subscription for organization ID:', finalOrgId);

  try {
    // Verify organization admin access
    const authResult = await orgAdminMiddleware(req, finalOrgId as string);
    console.log('🔍 API: Getting subscription for organization:', finalOrgId, 'by user:', authResult.userId);

    // For now, return mock subscription data since we don't have Stripe integration fully set up
    // TODO: Replace with actual Stripe subscription lookup
    const subscriptionData = {
      hasSubscription: false,
      subscription: null
    };

    console.log('✅ API: Subscription data:', subscriptionData);
    return res.status(200).json(subscriptionData);
  } catch (error: any) {
    console.error('❌ API: Exception in subscription endpoint:', error);
    
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