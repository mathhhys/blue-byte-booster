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
export const useTeamInvitations = () => {
  const { toast } = useToast();

  const sendInvitationHook = async (email: string, subscriptionId: string, inviterId: string) => {
    try {
      // Call API endpoint to send invitation
      const response = await fetch('/api/organization/invitations/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, subscriptionId, inviterId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invitation');
      }

      const result = await response.json();
      toast({ title: 'Success', description: 'Invitation sent. Seat reserved.' });
      return { success: true, invitation: result.invitation };
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return { success: false, error: error.message };
    }
  };

  const revokeInvitation = async (invitationId: string, dbInvitationId?: string, organizationId?: string) => {
    try {
      // Call API endpoint to revoke invitation
      const response = await fetch('/api/organization/invitations/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invitationId, dbInvitationId, organizationId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke invitation');
      }

      toast({ title: 'Success', description: 'Invitation revoked successfully.' });
      return true;
    } catch (error: any) {
      console.error('Error revoking invitation:', error);
      toast({ title: 'Error', description: 'Failed to revoke invitation', variant: 'destructive' });
      return false;
    }
  };

  return { sendInvitation: sendInvitationHook, revokeInvitation };
};

// Utility functions for invitation management
export const invitationUtils = {
  validateEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  generateInvitationLink: (orgId: string, invitationId: string): string => {
    // This would generate the actual invitation link
    // For now, return a placeholder
    return `https://app.softcodes.ai/accept-invitation?org=${orgId}&invitation=${invitationId}`;
  },

  formatInvitationStatus: (status: string): string => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'accepted':
        return 'Accepted';
      case 'expired':
        return 'Expired';
      case 'revoked':
        return 'Revoked';
      default:
        return status;
    }
  }
};