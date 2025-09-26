import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuth } from '@clerk/nextjs/server';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const auth = await getAuth(request);

  if (!auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is org member (admin preferred, but list for members)
  // In full impl, check membership role via Clerk API

  try {
    // Fetch seats
    const { data: seats, error: seatsError } = await supabase
      .from('organization_seats')
      .select('*')
      .eq('clerk_org_id', orgId)
      .eq('status', 'active');

    if (seatsError) throw seatsError;

    // Fetch usage
    const { data: usages, error: usagesError } = await supabase
      .from('license_usages')
      .select('*')
      .eq('organization_id', (await supabase.from('organizations').select('id').eq('clerk_org_id', orgId).single()).data?.id)
      .gte('period_start', new Date().toISOString().split('T')[0]); // Current month approx

    if (usagesError) throw usagesError;

    return NextResponse.json({ seats, usages });
  } catch (error) {
    console.error('Error fetching seats:', error);
    return NextResponse.json({ error: 'Failed to fetch seats' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { userEmail, userName, expiresAt } = await request.json();
  const orgId = request.headers.get('x-clerk-org-id');

  if (!orgId || !userEmail) {
    return NextResponse.json({ error: 'Organization ID and user email required' }, { status: 400 });
  }

  const auth = await getAuth(request);
  if (!auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate admin role (adapt from Clerk membership)
  // const membership = await clerkClient.organizations.getOrganizationMembership({ organizationId: orgId, userId: user.id });
  // if (membership.publicRole !== 'admin') return NextResponse.json({ error: 'Admin required' }, { status: 403 });

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase.rpc('assign_organization_seat', {
      p_clerk_org_id: orgId,
      p_clerk_user_id: auth.userId, // Or from invite
      p_user_email: userEmail,
      p_user_name: userName,
      p_assigned_by: auth.userId,
      p_expires_at: expiresAt || null
    });

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ error: 'Failed to assign seat (no subscription or limit reached)' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Seat assigned' });
  } catch (error) {
    console.error('Error assigning seat:', error);
    return NextResponse.json({ error: 'Failed to assign seat' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const orgId = request.headers.get('x-clerk-org-id');

  if (!orgId || !userId) {
    return NextResponse.json({ error: 'Organization ID and user ID required' }, { status: 400 });
  }

  const auth = await getAuth(request);
  if (!auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate admin
  // Similar check as POST

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase.rpc('remove_organization_seat', {
      p_clerk_org_id: orgId,
      p_clerk_user_id: userId
    });

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ error: 'Failed to revoke seat' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Seat revoked' });
  } catch (error) {
    console.error('Error revoking seat:', error);
    return NextResponse.json({ error: 'Failed to revoke seat' }, { status: 500 });
  }
}