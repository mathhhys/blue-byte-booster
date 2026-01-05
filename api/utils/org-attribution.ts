import { createClerkClient } from '@clerk/backend';

export type OrgAttributionClaims = {
  pool: 'organization';
  clerk_org_id: string;
  organization_id: string | null; // Supabase UUID
  organization_name: string | null;
  stripe_customer_id: string | null;
  organization_subscription_id: string | null;
  seat_id: string;
  seat_role: string | null;
  org_role: string | null;
};

type ResolveOrgMembershipParams = {
  clerkUserId: string;
  clerkOrgId: string;
  clerkClaims?: any;
};

type ResolveOrgAttributionParams = {
  supabase: any;
  clerkUserId: string;
  clerkOrgId?: string | null;
  clerkClaims?: any;
};

let cachedClerkClient: ReturnType<typeof createClerkClient> | null = null;

function getClerkClient() {
  if (!cachedClerkClient) {
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error('CLERK_SECRET_KEY is not configured');
    }
    cachedClerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  }
  return cachedClerkClient;
}

/**
 * Best-effort org membership check (claims-first; Clerk API fallback).
 * Returns { orgRole } if membership is confirmed, otherwise null.
 */
export async function resolveOrgMembership(
  params: ResolveOrgMembershipParams
): Promise<{ orgRole: string; source: 'claims' | 'api' } | null> {
  const { clerkUserId, clerkOrgId, clerkClaims } = params;

  if (!clerkOrgId) {
    return null;
  }

  const orgsFromClaims = (clerkClaims?.organizations || {}) as Record<string, any>;
  const orgFromClaims = orgsFromClaims?.[clerkOrgId];

  if (orgFromClaims) {
    return { orgRole: orgFromClaims?.role || 'org:member', source: 'claims' };
  }

  // Fallback to Clerk API
  try {
    const membershipsResponse = await getClerkClient().users.getOrganizationMembershipList({
      userId: clerkUserId,
      limit: 100
    });

    const memberships = Array.isArray((membershipsResponse as any)?.data)
      ? (membershipsResponse as any).data
      : [];

    const apiMembership = memberships.find((m: any) => {
      const candidateOrgId = m?.organization?.id ?? m?.organizationId ?? m?.organizationID;
      return candidateOrgId === clerkOrgId;
    });

    if (apiMembership) {
      return { orgRole: apiMembership?.role || 'org:member', source: 'api' };
    }
  } catch (apiError) {
    console.error('Clerk API membership lookup failed:', apiError);
  }

  return null;
}

/**
 * Resolve org attribution claims for a token (seat-gated).
 * - If the user is not a member or has no active seat, returns null (personal token).
 */
export async function resolveOrgAttributionClaims(
  params: ResolveOrgAttributionParams
): Promise<OrgAttributionClaims | null> {
  const { supabase, clerkUserId, clerkOrgId, clerkClaims } = params;

  if (!clerkOrgId) {
    return null;
  }

  const membership = await resolveOrgMembership({
    clerkUserId,
    clerkOrgId,
    clerkClaims
  });

  if (!membership) {
    return null;
  }

  // Seat-gating: only active seat holders receive org-scoped tokens
  const { data: seat, error: seatError } = await supabase
    .from('organization_seats')
    .select('id, role, organization_subscription_id')
    .eq('clerk_org_id', clerkOrgId)
    .eq('clerk_user_id', clerkUserId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (seatError) {
    console.error('Error fetching active seat:', seatError);
    return null;
  }

  if (!seat) {
    return null;
  }

  const [{ data: organization }, { data: subscription, error: subError }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, stripe_customer_id')
      .eq('clerk_org_id', clerkOrgId)
      .maybeSingle(),
    supabase
      .from('organization_subscriptions')
      .select('id, organization_id')
      .eq('id', seat.organization_subscription_id)
      .in('status', ['active', 'trialing'])
      .maybeSingle()
  ]);

  if (subError) {
    console.error('Error fetching organization subscription:', subError);
  }

  return {
    pool: 'organization',
    clerk_org_id: clerkOrgId,
    organization_id: organization?.id || subscription?.organization_id || null,
    organization_name: organization?.name || null,
    stripe_customer_id: organization?.stripe_customer_id || null,
    organization_subscription_id: subscription?.id || seat.organization_subscription_id || null,
    seat_id: seat.id,
    seat_role: seat.role || null,
    org_role: membership.orgRole || 'org:member'
  };
}