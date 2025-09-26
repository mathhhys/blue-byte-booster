import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { Clerk } from '@clerk/clerk-sdk-node';
import { teamInvitationOperations } from '@/utils/supabase/database';

const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY! });

export async function POST(request: NextRequest) {
  try {
    const { invitationId, dbInvitationId, organizationId } = await request.json();

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 }
      );
    }

    // Authenticate user
    const auth = await getAuth(request);
    if (!auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Revoke invitation in Clerk
    try {
      if (organizationId) {
        await clerk.organizations.revokeOrganizationInvitation({
          organizationId,
          invitationId,
          requestingUserId: auth.userId
        });
      } else {
        console.warn('No organizationId provided for Clerk invitation revocation');
      }
    } catch (clerkError: any) {
      console.error('Error revoking Clerk invitation:', clerkError);
      // Continue with database update even if Clerk revoke fails
    }

    // Update invitation status in database if dbInvitationId provided
    if (dbInvitationId) {
      const { error: dbError } = await teamInvitationOperations.updateInvitationStatus(
        dbInvitationId,
        'revoked'
      );

      if (dbError) {
        console.error('Error updating database invitation status:', dbError);
        return NextResponse.json(
          { error: 'Failed to update invitation status in database' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation revoked successfully'
    });

  } catch (error: any) {
    console.error('Error revoking invitation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to revoke invitation' },
      { status: 500 }
    );
  }
}