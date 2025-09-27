import { verifyToken } from '@clerk/backend';

export interface AuthResult {
  userId: string;
  orgId: string;
  orgRole: string;
}

export async function orgAdminMiddleware(req: any, orgId: string): Promise<AuthResult> {
  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);
    
    // Verify the Clerk token
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!
    });

    console.log('🔍 DEBUG: Token claims:', JSON.stringify(claims, null, 2));
    
    const userId = claims.sub;
    if (!userId) {
      console.log('❌ DEBUG: No userId found in claims');
      throw new Error('Authentication required');
    }
    
    console.log('✅ DEBUG: User ID from token:', userId);
    console.log('🔍 DEBUG: Requested org ID:', orgId);

    // Check if user belongs to the organization
    const userOrgs = claims.organizations || {};
    console.log('🔍 DEBUG: User organizations from token:', JSON.stringify(userOrgs, null, 2));
    
    const userOrg = userOrgs[orgId];
    console.log('🔍 DEBUG: User org for requested orgId:', userOrg);

    if (!userOrg) {
      console.log('❌ DEBUG: User does not belong to organization:', orgId);
      console.log('❌ DEBUG: Available organizations:', Object.keys(userOrgs));
      throw new Error('User does not belong to this organization');
    }

    console.log('✅ DEBUG: User belongs to org, role:', userOrg.role);

    // Check if user is an admin in the organization
    if (userOrg.role !== 'org:admin') {
      console.log('❌ DEBUG: User is not admin. Current role:', userOrg.role);
      throw new Error('User is not an organization admin');
    }
    
    console.log('✅ DEBUG: User is organization admin');

    return {
      userId,
      orgId,
      orgRole: userOrg.role
    };
  } catch (error) {
    console.error('Clerk middleware error:', error);
    throw error;
  }
}

export async function getAuthUser(req: any): Promise<{ userId: string }> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);
    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!
    });

    const userId = claims.sub;
    if (!userId) {
      throw new Error('Authentication required');
    }

    return { userId };
  } catch (error) {
    console.error('Auth error:', error);
    throw error;
  }
}