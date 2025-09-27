import { organizationSeatOperations } from '../../../src/utils/supabase/database.js';
import { orgAdminMiddleware } from '../../../src/utils/clerk/token-verification.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orgId, org_id, userEmail, email, role } = req.body;
  
  console.log('🔍 DEBUG: Assign endpoint - Received body:', req.body);
  
  const finalOrgId = orgId || org_id;
  const finalEmail = userEmail || email;

  if (!finalOrgId || !finalEmail) {
    console.log('❌ DEBUG: Missing parameters - orgId/org_id:', finalOrgId, 'userEmail/email:', finalEmail);
    return res.status(400).json({ error: 'Organization ID and user email are required' });
  }
  
  console.log('✅ DEBUG: Using orgId:', finalOrgId, 'email:', finalEmail);

  try {
    // Verify organization admin access
    const authResult = await orgAdminMiddleware(req, finalOrgId);
    console.log('🔍 API: Assigning seat for organization:', finalOrgId, 'by user:', authResult.userId, 'to email:', finalEmail);

    const { data, error } = await organizationSeatOperations.assignSeat(finalOrgId, finalEmail, role || 'member');

    if (error) {
      console.error('❌ API: Database error:', error);
      
      if (error === 'No available seats. Please upgrade your plan.') {
        return res.status(402).json({ 
          error: 'Insufficient seats',
          message: 'No available seats. Please upgrade your plan to add more seats.'
        });
      }
      
      if (error === 'User already has an active seat in this organization') {
        return res.status(400).json({ error: 'User already has an active seat' });
      }
      
      return res.status(500).json({ error: 'Database error', details: error });
    }

    console.log('✅ API: Seat assigned successfully');
    return res.status(201).json({ 
      data, 
      error: null,
      message: 'Seat assigned successfully'
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