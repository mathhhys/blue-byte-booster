import { verifyToken, createClerkClient } from '@clerk/backend';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!
});

const normalizeOrgRole = (role?: string | null) => {
  if (!role) {
    return undefined;
  }

  const normalized = role.toLowerCase();
  if (normalized === 'org:admin' || normalized === 'admin' || normalized === 'organization_admin') {
    return 'org:admin';
  }

  return role;
};

const isAdminRole = (role?: string | null) => normalizeOrgRole(role) === 'org:admin';

const extractMembershipArray = (response: unknown) => {
  if (!response) {
    return [];
  }

  const value = response as any;

  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  return [];
};

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
    const userOrgs = (claims.organizations as Record<string, any>) || {};
    console.log('🔍 DEBUG: User organizations from token:', JSON.stringify(userOrgs, null, 2));
    console.log('🔍 DEBUG: Available organization keys:', Object.keys(userOrgs));
    console.log('🔍 DEBUG: Checking for org ID in organizations:', orgId in userOrgs);
    
    const userOrg = userOrgs[orgId];
    console.log('🔍 DEBUG: User org for requested orgId:', userOrg);

    if (!userOrg) {
      console.log('❌ DEBUG: User does not belong to organization in token claims:', orgId);
      console.log('❌ DEBUG: Available organizations from token claims:', Object.keys(userOrgs));
    } else {
      console.log('✅ DEBUG: User belongs to org (claims), role:', userOrg.role);
      if (!isAdminRole(userOrg.role)) {
        console.log('❌ DEBUG: User is not admin in token claims. Current role:', userOrg.role);
      } else {
        console.log('✅ DEBUG: Token claims show admin access');
      }
    }

    let membershipFound = !!userOrg;
    let membershipRole = normalizeOrgRole(userOrg?.role);
    let membershipSource: 'claims' | 'api' | 'unknown' = membershipFound ? 'claims' : 'unknown';

    if (!membershipFound || !isAdminRole(membershipRole)) {
      console.log('🔄 DEBUG: Attempting Clerk API membership fallback lookup');
      try {
        const membershipsResponse = await clerkClient.users.getOrganizationMembershipList({
          userId,
          limit: 100
        });

        const membershipCandidates = extractMembershipArray(membershipsResponse);
        console.log('🔍 DEBUG: Fallback membership count:', membershipCandidates.length);

        const apiMembership = membershipCandidates.find((membership: any) => {
          const candidateOrgId =
            membership?.organization?.id ?? membership?.organizationId ?? membership?.organizationID;
          return candidateOrgId === orgId;
        });

        console.log('🔍 DEBUG: Fallback membership for requested org:', apiMembership);

        if (apiMembership) {
          membershipFound = true;
          membershipSource = 'api';
          membershipRole = normalizeOrgRole(apiMembership.role);
          console.log('✅ DEBUG: Membership resolved via Clerk API fallback. Normalized role:', membershipRole);
        } else {
          console.log('❌ DEBUG: Clerk API fallback did not find membership for org:', orgId);
        }
      } catch (apiError) {
        console.error('❌ DEBUG: Clerk API membership fallback failed:', apiError);
      }
    }

    if (!membershipFound) {
      console.log('❌ DEBUG: User does not belong to organization after fallback:', orgId);
      throw new Error('User does not belong to this organization');
    }

    if (!isAdminRole(membershipRole)) {
      console.log('❌ DEBUG: User is not admin after fallback. Current role:', membershipRole);
      throw new Error('User is not an organization admin');
    }

    console.log('✅ DEBUG: User is organization admin');
    console.log('✅ DEBUG: Admin status verified via:', membershipSource);

    return {
      userId,
      orgId,
      orgRole: membershipRole!
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