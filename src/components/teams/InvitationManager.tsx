import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mail, 
  Plus, 
  Trash2, 
  Send, 
  Users, 
  CheckCircle, 
  Clock, 
  XCircle,
  Copy,
  ExternalLink
} from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { useTeamInvitations, invitationUtils } from '@/utils/clerk/invitations';
import { teamInvitationOperations } from '@/utils/supabase/database';
import { TeamInvitation } from '@/utils/supabase/database';

interface InvitationManagerProps {
  subscriptionId: string;
  maxSeats: number;
  onClose?: () => void;
}

export const InvitationManager: React.FC<InvitationManagerProps> = ({
  subscriptionId,
  maxSeats,
  onClose
}) => {
  const { user } = useUser();
  const { sendInvitation, revokeInvitation } = useTeamInvitations();

  const [emailInput, setEmailInput] = useState('');
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadInvitations();
  }, [subscriptionId]);

  const loadInvitations = async () => {
    try {
      const { data, error } = await teamInvitationOperations.getSubscriptionInvitations(subscriptionId);
      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error loading invitations:', error);
      setError('Failed to load invitations');
    }
  };

  const handleSendInvitation = async () => {
    if (!user || !emailInput.trim()) return;

    // Validate email
    if (!invitationUtils.validateEmail(emailInput)) {
      setError('Please enter a valid email address');
      return;
    }

    // Check if email already invited
    const existingInvitation = invitations.find(
      inv => inv.email.toLowerCase() === emailInput.toLowerCase() && inv.status === 'pending'
    );
    
    if (existingInvitation) {
      setError('This email has already been invited');
      return;
    }

    // Check seat limit
    const pendingAndAcceptedInvitations = invitations.filter(
      inv => inv.status === 'pending' || inv.status === 'accepted'
    );
    
    if (pendingAndAcceptedInvitations.length >= maxSeats - 1) { // -1 for the owner
      setError(`Maximum of ${maxSeats} team members allowed`);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await sendInvitation(emailInput, subscriptionId, user.id);
      
      if (result.success) {
        setSuccess(`Invitation sent to ${emailInput}`);
        setEmailInput('');
        await loadInvitations(); // Reload to show new invitation
      } else {
        setError(result.error || 'Failed to send invitation');
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      setError('Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeInvitation = async (invitation: TeamInvitation) => {
    if (!invitation.clerk_invitation_id) return;

    setIsLoading(true);
    setError(null);

    try {
      const success = await revokeInvitation(invitation.clerk_invitation_id, invitation.id, subscriptionId);

      if (success) {
        setSuccess(`Invitation to ${invitation.email} has been revoked`);
        await loadInvitations(); // Reload to show updated status
      } else {
        setError('Failed to revoke invitation');
      }
    } catch (error) {
      console.error('Error revoking invitation:', error);
      setError('Failed to revoke invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyInviteLink = (invitation: TeamInvitation) => {
    if (!invitation.clerk_invitation_id) return;

    const inviteLink = invitationUtils.generateInvitationLink('org_id', invitation.clerk_invitation_id);
    navigator.clipboard.writeText(inviteLink);
    setSuccess('Invitation link copied to clipboard');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'expired':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      case 'revoked':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'pending':
        return 'outline';
      case 'accepted':
        return 'default';
      case 'expired':
      case 'revoked':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const pendingAndAcceptedCount = invitations.filter(
    inv => inv.status === 'pending' || inv.status === 'accepted'
  ).length;

  const remainingSeats = maxSeats - 1 - pendingAndAcceptedCount; // -1 for owner

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Users className="w-5 h-5" />
            Team Invitation Manager
          </CardTitle>
          <p className="text-gray-300">
            Invite team members to join your Softcodes Teams subscription
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Seat Usage Summary */}
          <div className="bg-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium">Seat Usage</span>
              <span className="text-gray-300">
                {pendingAndAcceptedCount + 1} / {maxSeats} seats used
              </span>
            </div>
            <div className="w-full bg-slate-600 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((pendingAndAcceptedCount + 1) / maxSeats) * 100}%` }}
              />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              {remainingSeats > 0 
                ? `${remainingSeats} seat${remainingSeats > 1 ? 's' : ''} remaining`
                : 'All seats are occupied'
              }
            </p>
          </div>

          {/* Send Invitation Form */}
          {remainingSeats > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Send New Invitation</h3>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    type="email"
                    placeholder="Enter team member's email address"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                    onKeyPress={(e) => e.key === 'Enter' && handleSendInvitation()}
                  />
                </div>
                <Button
                  onClick={handleSendInvitation}
                  disabled={isLoading || !emailInput.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send Invite
                </Button>
              </div>
            </div>
          )}

          {/* Status Messages */}
          {error && (
            <Alert className="border-red-500/30 bg-red-900/20">
              <XCircle className="w-4 h-4" />
              <AlertDescription className="text-red-300">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-500/30 bg-green-900/20">
              <CheckCircle className="w-4 h-4" />
              <AlertDescription className="text-green-300">{success}</AlertDescription>
            </Alert>
          )}

          {/* Invitations List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Team Invitations</h3>
            
            {invitations.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No invitations sent yet</p>
                <p className="text-sm">Send your first invitation to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-4 bg-slate-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(invitation.status)}
                      <div>
                        <p className="text-white font-medium">{invitation.email}</p>
                        <p className="text-sm text-gray-400">
                          Invited {new Date(invitation.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusBadgeVariant(invitation.status)}>
                        {invitationUtils.formatInvitationStatus(invitation.status)}
                      </Badge>
                      
                      {invitation.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyInviteLink(invitation)}
                            className="border-slate-600 text-gray-300 hover:bg-slate-600"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokeInvitation(invitation)}
                            disabled={isLoading}
                            className="border-red-500/30 text-red-400 hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-6 border-t border-slate-600">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-slate-600 text-gray-300 hover:bg-slate-700"
            >
              Close
            </Button>
            <Button
              onClick={() => window.location.href = '/dashboard'}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InvitationManager;