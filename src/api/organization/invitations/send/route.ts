import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { sendInvitation } from '@/utils/clerk/invitations';
import { teamInvitationOperations } from '@/utils/supabase/database';

export async function POST(request: NextRequest) {
  try {
    const { email, subscriptionId, inviterId } = await request.json();

    if (!email || !subscriptionId || !inviterId) {
      return NextResponse.json(
        { error: 'Email, subscription ID, and inviter ID are required' },
        { status: 400 }
      );
    }

    // Authenticate user
    const auth = await getAuth(request);
    if (!auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the inviter is the authenticated user
    if (auth.userId !== inviterId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Send invitation via Clerk
    const invitation = await sendInvitation(email, subscriptionId, inviterId);

    // Create team invitation record in database
    const { data: dbInvitation, error: dbError } = await teamInvitationOperations.createInvitation({
      subscription_id: subscriptionId,
      inviter_id: inviterId,
      email,
      clerk_invitation_id: invitation.id
    });

    if (dbError) {
      console.error('Error creating database invitation record:', dbError);
      // Don't fail the request if database record creation fails
      // The Clerk invitation was already sent successfully
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.emailAddress,
        status: 'pending',
        createdAt: invitation.createdAt,
        dbInvitationId: dbInvitation?.id
      }
    });

  } catch (error: any) {
    console.error('Error sending invitation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send invitation' },
      { status: 500 }
    );
  }
}