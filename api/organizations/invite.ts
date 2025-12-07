import { createClerkClient } from '@clerk/backend';
import { orgAdminMiddleware } from '../../src/utils/clerk/token-verification.js';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!
});

export default async function handler(req: any, res: any) {
  console.log('🟢 INVITE API ROUTE HIT');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orgId, email, role } = req.body;

    if (!orgId || !email) {
      return res.status(400).json({ error: 'Organization ID and email are required' });
    }

    // Authenticate org admin
    console.log('🔍 Calling orgAdminMiddleware for org:', orgId);
    const authResult = await orgAdminMiddleware(req, orgId);
    console.log('✅ Middleware passed for user:', authResult.userId, 'in org:', orgId);

    // Create invitation using Clerk Backend SDK
    console.log(`🔍 Creating invitation for ${email} in org ${orgId}`);
    
    const invitation = await clerkClient.organizations.createOrganizationInvitation({
      organizationId: orgId,
      emailAddress: email,
      role: role || 'basic_member',
      inviterUserId: authResult.userId,
    });

    console.log('✅ Invitation created:', invitation.id);

    return res.status(200).json({ 
      success: true, 
      invitation: {
        id: invitation.id,
        email: invitation.emailAddress,
        role: invitation.role,
        status: invitation.status,
        created_at: invitation.createdAt,
      }
    });

  } catch (error: any) {
    console.error('❌ Error creating invitation:', error);
    
    if (error.message.includes('Missing or invalid Authorization header')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (error.message.includes('User does not belong to this organization') || error.message.includes('User is not an organization admin')) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Handle Clerk errors
    if (error.errors && error.errors.length > 0) {
      const clerkError = error.errors[0];
      return res.status(400).json({ error: clerkError.message || 'Failed to create invitation' });
    }

    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}