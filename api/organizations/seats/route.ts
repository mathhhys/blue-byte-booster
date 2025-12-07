import { organizationSeatOperations } from '../../../src/utils/supabase/database.js';
import { orgAdminMiddleware } from '../../../src/utils/clerk/token-verification.js';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get('org_id');

    if (!orgId) {
      return Response.json({ error: 'Organization ID (org_id) is required' }, { status: 400 });
    }

    // Authenticate org admin
    // Note: For GET seats, maybe just member access is enough? But usually billing info is admin only.
    // The middleware checks for admin.
    const authResult = await orgAdminMiddleware({ headers: Object.fromEntries(req.headers.entries()) } as any, orgId);
    console.log('🔍 API: Fetching seats for organization:', orgId, 'by user:', authResult.userId);

    const { data, error } = await organizationSeatOperations.getSeatsForOrganization(orgId);

    if (error) {
      console.error('❌ API: Database error:', error);
      return Response.json({ error: 'Database error', details: error }, { status: 500 });
    }

    return Response.json(data);

  } catch (error: any) {
    console.error('❌ API: Exception:', error);
    if (error.message?.includes('Missing or invalid Authorization header')) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (error.message?.includes('User does not belong to this organization') || error.message?.includes('User is not an organization admin')) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}