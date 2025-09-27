import { organizationSubscriptionOperations } from '../../../src/utils/supabase/database.js';
import { orgAdminMiddleware } from '../../../src/utils/clerk/token-verification.js';

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

    // Update the database
    const { data: subscription, error: dbError } = await organizationSubscriptionOperations.updateSubscriptionQuantity(orgId, newQuantity);

    if (dbError) {
      console.error('❌ API: Database error:', dbError);
      return res.status(500).json({ error: 'Database error', details: dbError });
    }

    console.log('✅ API: Subscription quantity updated successfully');
    return res.status(200).json({ 
      data: subscription, 
      error: null,
      message: 'Subscription quantity updated successfully'
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