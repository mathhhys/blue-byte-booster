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

    const userId = claims.sub;
    if (!userId) {
      throw new Error('Authentication required');
    }

    // Check if user belongs to the organization
    const userOrgs = claims.organizations || {};
    const userOrg = userOrgs[orgId];

    if (!userOrg) {
      throw new Error('User does not belong to this organization');
    }

    // Check if user is an admin in the organization
    if (userOrg.role !== 'org:admin') {
      throw new Error('User is not an organization admin');
    }

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