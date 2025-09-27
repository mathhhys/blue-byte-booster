import { organizationSeatOperations } from '../../src/utils/supabase/database.js';
import { orgAdminMiddleware } from '../../src/utils/clerk/token-verification.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId } = req.query;

  if (!orgId) {
    return res.status(400).json({ error: 'Organization ID is required' });
  }

  try {
    // Verify organization admin access
    const authResult = await orgAdminMiddleware(req, orgId as string);
    console.log('🔍 API: Getting seats for organization:', orgId, 'by user:', authResult.userId);

    const { data, error } = await organizationSeatOperations.getSeatsForOrganization(orgId as string);

    if (error) {
      console.error('❌ API: Database error:', error);
      return res.status(500).json({ error: 'Database error', details: error });
    }

    console.log('✅ API: Seats found:', data?.seats_used, '/', data?.seats_total);
    return res.status(200).json({ 
      data, 
      error: null 
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