import { useOrganization, useOrganizationList } from '@clerk/clerk-react';
import { teamInvitationOperations } from '@/utils/supabase/database';
import { InvitationData, InvitationResult } from '@/types/database';

// Clerk organization and invitation management
export class ClerkInvitationManager {
  private organizationId: string | null = null;

  constructor(organizationId?: string) {
    this.organizationId = organizationId || null;
  }

  // Create or get organization for team subscription
  async ensureOrganization(teamName: string, creatorUserId: string): Promise<string> {
    try {
      // In a real implementation, you would use Clerk's API to create an organization
      // For now, we'll simulate this process
      
      // Check if user already has an organization
      const existingOrgId = await this.getUserOrganization(creatorUserId);
      
      if (existingOrgId) {
        this.organizationId = existingOrgId;
        return existingOrgId;
      }

      // Create new organization
      const orgId = await this.createOrganization(teamName, creatorUserId);
      this.organizationId = orgId;
      
      return orgId;
    } catch (error) {
      console.error('Error ensuring organization:', error);
      throw new Error('Failed to create or get organization');
    }
  }

  // Create organization using Clerk
  private async createOrganization(name: string, creatorUserId: string): Promise<string> {
    try {
      // This would use Clerk's API to create an organization
      // const organization = await clerk.organizations.createOrganization({
      //   name,
      //   createdBy: creatorUserId,
      // });
      
      // For now, return a mock organization ID
      const mockOrgId = `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`Created organization: ${name} with ID: ${mockOrgId}`);
      return mockOrgId;
    } catch (error) {
      console.error('Error creating organization:', error);
      throw new Error('Failed to create organization');
    }
  }

  // Get user's organization
  private async getUserOrganization(userId: string): Promise<string | null> {
    try {
      // This would query Clerk for user's organizations
      // const organizations = await clerk.users.getOrganizationMemberships(userId);
      // return organizations[0]?.organization.id || null;
      
      // For now, return null to always create new organization
      return null;
    } catch (error) {
      console.error('Error getting user organization:', error);
      return null;
    }
  }

  // Send invitation using Clerk's native invitation system
  async sendInvitation(invitationData: InvitationData): Promise<InvitationResult> {
    try {
      if (!this.organizationId) {
        throw new Error('Organization not initialized');
      }

      // Create invitation using Clerk's API
      const clerkInvitation = await this.createClerkInvitation(
        this.organizationId,
        invitationData.email
      );

      // Store invitation in our database
      const { data: dbInvitation, error } = await teamInvitationOperations.createInvitation({
        subscription_id: invitationData.subscriptionId,
        inviter_id: invitationData.inviterId,
        email: invitationData.email,
        clerk_invitation_id: clerkInvitation.id,
      });

      if (error) {
        throw new Error('Failed to store invitation in database');
      }

      return {
        success: true,
        invitationId: dbInvitation?.id,
        clerkInvitationId: clerkInvitation.id,
      };
    } catch (error) {
      console.error('Error sending invitation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send invitation',
      };
    }
  }

  // Create Clerk invitation
  private async createClerkInvitation(organizationId: string, email: string) {
    try {
      // This would use Clerk's API to create an invitation
      // const invitation = await clerk.organizations.createInvitation({
      //   organizationId,
      //   emailAddress: email,
      //   role: 'basic_member', // or whatever role you want
      // });

      // Mock invitation for development
      const mockInvitation = {
        id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        organizationId,
        emailAddress: email,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      console.log(`Created Clerk invitation for ${email}:`, mockInvitation.id);
      return mockInvitation;
    } catch (error) {
      console.error('Error creating Clerk invitation:', error);
      throw new Error('Failed to create Clerk invitation');
    }
  }

  // Revoke invitation
  async revokeInvitation(clerkInvitationId: string, dbInvitationId: string): Promise<boolean> {
    try {
      // Revoke in Clerk
      await this.revokeClerkInvitation(clerkInvitationId);

      // Update status in database
      const { error } = await teamInvitationOperations.updateInvitationStatus(
        dbInvitationId,
        'revoked'
      );

      if (error) {
        throw new Error('Failed to update invitation status in database');
      }

      return true;
    } catch (error) {
      console.error('Error revoking invitation:', error);
      return false;
    }
  }

  // Revoke Clerk invitation
  private async revokeClerkInvitation(invitationId: string): Promise<void> {
    try {
      // This would use Clerk's API to revoke an invitation
      // await clerk.organizations.revokeInvitation(invitationId);
      
      console.log(`Revoked Clerk invitation: ${invitationId}`);
    } catch (error) {
      console.error('Error revoking Clerk invitation:', error);
      throw new Error('Failed to revoke Clerk invitation');
    }
  }

  // Get organization invitations
  async getOrganizationInvitations(): Promise<any[]> {
    try {
      if (!this.organizationId) {
        throw new Error('Organization not initialized');
      }

      // This would use Clerk's API to get organization invitations
      // const invitations = await clerk.organizations.getInvitations(this.organizationId);
      
      // Mock invitations for development
      const mockInvitations = [];
      
      return mockInvitations;
    } catch (error) {
      console.error('Error getting organization invitations:', error);
      return [];
    }
  }

  // Handle invitation acceptance (webhook handler)
  async handleInvitationAccepted(clerkInvitationId: string): Promise<void> {
    try {
      // Find invitation in database
      const { data: invitations } = await teamInvitationOperations.getInvitationsByEmail('');
      const invitation = invitations?.find(inv => inv.clerk_invitation_id === clerkInvitationId);

      if (!invitation) {
        throw new Error('Invitation not found in database');
      }

      // Update invitation status
      await teamInvitationOperations.updateInvitationStatus(invitation.id, 'accepted');

      // Grant credits to the new team member
      // This would be handled by your webhook system
      console.log(`Invitation accepted: ${clerkInvitationId}`);
    } catch (error) {
      console.error('Error handling invitation acceptance:', error);
      throw error;
    }
  }
}

// React hooks for invitation management
export const useTeamInvitations = (organizationId?: string) => {
  const invitationManager = new ClerkInvitationManager(organizationId);

  const sendInvitation = async (email: string, subscriptionId: string, inviterId: string) => {
    return await invitationManager.sendInvitation({
      email,
      subscriptionId,
      inviterId,
    });
  };

  const revokeInvitation = async (clerkInvitationId: string, dbInvitationId: string) => {
    return await invitationManager.revokeInvitation(clerkInvitationId, dbInvitationId);
  };

  const getInvitations = async () => {
    return await invitationManager.getOrganizationInvitations();
  };

  return {
    sendInvitation,
    revokeInvitation,
    getInvitations,
    invitationManager,
  };
};

// Utility functions for invitation management
export const invitationUtils = {
  // Validate email address
  validateEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Generate invitation link (for manual sharing)
  generateInvitationLink: (organizationId: string, invitationId: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/invite/${organizationId}/${invitationId}`;
  },

  // Parse invitation from URL
  parseInvitationFromUrl: (url: string): { organizationId?: string; invitationId?: string } => {
    const match = url.match(/\/invite\/([^\/]+)\/([^\/]+)/);
    if (match) {
      return {
        organizationId: match[1],
        invitationId: match[2],
      };
    }
    return {};
  },

  // Format invitation status for display
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
        return 'Unknown';
    }
  },

  // Get status color for UI
  getStatusColor: (status: string): string => {
    switch (status) {
      case 'pending':
        return 'text-yellow-500';
      case 'accepted':
        return 'text-green-500';
      case 'expired':
        return 'text-gray-500';
      case 'revoked':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  },
};