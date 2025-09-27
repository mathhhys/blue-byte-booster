import { organizationSeatOperations } from '../../../src/utils/supabase/database.js';
import { orgAdminMiddleware } from '../../../src/utils/clerk/token-verification.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId, clerkUserId } = req.query;

  if (!orgId || !clerkUserId) {
    return res.status(400).json({ error: 'Organization ID and Clerk User ID are required' });
  }

  try {
    // Verify organization admin access
    const authResult = await orgAdminMiddleware(req, orgId as string);
    console.log('🔍 API: Revoking seat for organization:', orgId, 'by user:', authResult.userId, 'for user:', clerkUserId);

    const { data, error } = await organizationSeatOperations.revokeSeat(orgId as string, clerkUserId as string, 'admin_revoked');

    if (error) {
      console.error('❌ API: Database error:', error);
      
      if (error === 'Active seat not found for this user') {
        return res.status(404).json({ error: 'Active seat not found for this user' });
      }
      
      return res.status(500).json({ error: 'Database error', details: error });
    }

    console.log('✅ API: Seat revoked successfully');
    return res.status(200).json({ 
      data, 
      error: null,
      message: 'Seat revoked successfully'
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