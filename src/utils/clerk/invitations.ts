import { Clerk } from '@clerk/clerk-sdk-node';
import { createClient } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast'; // For client-side, but server uses console

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY! });

export async function sendInvitation(
  email: string,
  orgId: string,
  inviterId: string,
  role: 'member' | 'admin' = 'member'
) {
  // Check available seats before invite (adapt repo's validation)
  const { data: sub } = await supabase
    .from('organization_subscriptions')
    .select('seats_total, seats_used')
    .eq('clerk_org_id', orgId)
    .eq('status', 'active')
    .single();

  if (!sub || sub.seats_used >= sub.seats_total) {
    throw new Error('No available seats. Upgrade your subscription to invite more members.');
  }

  try {
    // Send Clerk invite
    const invitation = await clerk.organizations.createOrganizationInvitation({
      organizationId: orgId,
      inviterUserId: inviterId,
      emailAddress: email,
      role,
      publicMetadata: { invitedBy: inviterId, status: 'pending' },
    });

    // Mark pending seat (assign on acceptance via webhook)
    await supabase.rpc('assign_organization_seat', {
      p_clerk_org_id: orgId,
      p_clerk_user_id: null, // Set on acceptance
      p_user_email: email,
      p_user_name: null,
      p_assigned_by: inviterId,
      p_expires_at: null
    });

    return invitation;
  } catch (error) {
    console.error('Failed to send invitation:', error);
    throw new Error('Failed to send invitation. Please try again.');
  }
}

export async function handleMemberAcceptance(invitationId: string, userId: string, orgId: string) {
  try {
    // Update pending seat to active with userId
    await supabase.rpc('assign_organization_seat', {
      p_clerk_org_id: orgId,
      p_clerk_user_id: userId,
      p_user_email: '', // Fetch from Clerk if needed
      p_user_name: '',
      p_assigned_by: '', // From metadata
      p_expires_at: null
    });

    // Invitation status updated automatically on acceptance

    console.log('Seat assigned on member acceptance');
  } catch (error) {
    console.error('Failed to handle acceptance:', error);
    throw error;
  }
}

export async function handleMemberLeave(orgId: string, userId: string) {
  // Revoke seat on leave (adapt repo's revocation)
  try {
    await supabase.rpc('remove_organization_seat', {
      p_clerk_org_id: orgId,
      p_clerk_user_id: userId
    });

    // Remove from Clerk org
    await clerk.organizations.deleteOrganizationMembership({
      organizationId: orgId,
      userId
    });

    console.log('Seat revoked on member leave');
  } catch (error) {
    console.error('Failed to handle member leave:', error);
    throw error;
  }
}

// Client-side wrapper for UI (e.g., in InvitationManager)
export const useInvitations = () => {
  const { toast } = useToast();

  const inviteMember = async (email: string, orgId: string, inviterId: string) => {
    try {
      await sendInvitation(email, orgId, inviterId);
      toast({ title: 'Success', description: 'Invitation sent. Seat reserved.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return { inviteMember };
};