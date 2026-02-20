import { verifyToken, createClerkClient } from '@clerk/backend';

let cachedClerkClient: ReturnType<typeof createClerkClient> | null = null;

function getClerkSecretKey(): string {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) {
    throw new Error('CLERK_SECRET_KEY is not configured');
  }
  return key;
}

function getClerkClient() {
  if (!cachedClerkClient) {
    cachedClerkClient = createClerkClient({
      secretKey: getClerkSecretKey()
    });
  }
  return cachedClerkClient;
}

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

export async function orgMemberMiddleware(req: any, orgId: string): Promise<AuthResult> {
  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);
    
    // Verify the Clerk token
    const claims = await verifyToken(token, {
      secretKey: getClerkSecretKey()
    });

    const userId = claims.sub;
    if (!userId) {
      throw new Error('Authentication required');
    }

    // Check if user belongs to the organization
    const userOrgs = (claims.organizations as Record<string, any>) || {};
    const userOrg = userOrgs[orgId];

    let membershipFound = !!userOrg;
    let membershipRole = normalizeOrgRole(userOrg?.role);

    if (!membershipFound) {
      try {
        const membershipsResponse = await getClerkClient().users.getOrganizationMembershipList({
          userId,
          limit: 100
        });

        const membershipCandidates = extractMembershipArray(membershipsResponse);
        const apiMembership = membershipCandidates.find((membership: any) => {
          const candidateOrgId =
            membership?.organization?.id ?? membership?.organizationId ?? membership?.organizationID;
          return candidateOrgId === orgId;
        });

        if (apiMembership) {
          membershipFound = true;
          membershipRole = normalizeOrgRole(apiMembership.role);
        }
      } catch (apiError) {
        console.error('Clerk API membership fallback failed:', apiError);
      }
    }

    if (!membershipFound) {
      throw new Error('User does not belong to this organization');
    }

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

export async function orgAdminMiddleware(req: any, orgId: string): Promise<AuthResult> {
  try {
    const result = await orgMemberMiddleware(req, orgId);
    
    if (!isAdminRole(result.orgRole)) {
      throw new Error('User is not an organization admin');
    }

    return result;
  } catch (error) {
    console.error('Clerk admin middleware error:', error);
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
      secretKey: getClerkSecretKey()
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