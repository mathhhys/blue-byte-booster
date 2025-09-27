import { useState, useEffect } from 'react';
import { useOrganization, useOrganizationList } from '@clerk/clerk-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard,
  Users,
  Settings,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ExternalLink,
  Crown,
  Mail,
  UserPlus,
  Clock,
  X,
} from 'lucide-react';
import {
  createOrganizationBillingPortal,
  createOrganizationSubscription,
  getOrganizationSubscription,
  formatSeatCost,
  assignSeatToMember,
} from '@/utils/organization/billing';

interface BillingDashboardProps {
  className?: string;
}

export const BillingDashboard = ({ className }: BillingDashboardProps) => {
  const { organization, membership, memberships, invitations } = useOrganization();
  const { toast } = useToast();
  
  const [subscriptionData, setSubscriptionData] = useState<{
    seats_total: number;
    plan_type: string;
    status: string;
    billing_frequency: string;
    stripe_subscription_id: string | null;
  } | null>(null);
  const [seatsData, setSeatsData] = useState<{
    seats_used: number;
    seats_total: number;
    seats: Array<{
      user_id: string;
      email: string;
      status: string;
      role: string | null;
      assigned_at: string;
    }>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const isAdmin = membership?.role === 'org:admin';
  const memberCount = memberships?.count || 0;
  const pendingInvitationsCount = invitations?.count || 0;
  
  // Use seatsData if available, otherwise fall back to Clerk data
  const totalUsedSeats = seatsData?.seats_used || (memberCount + pendingInvitationsCount);
  const maxSeats = subscriptionData?.seats_total || 0;
  const availableSeats = Math.max(0, maxSeats - totalUsedSeats);
  const percentUsed = maxSeats > 0 ? Math.round((totalUsedSeats / maxSeats) * 100) : 0;

  useEffect(() => {
    if (organization?.id) {
      loadBillingInfo();
    }
  }, [organization?.id, memberships?.count]);

  const loadBillingInfo = async () => {
    if (!organization?.id) return;
    
    try {
      setIsLoading(true);
      
      // Fetch real subscription data from Stripe
      const result = await getOrganizationSubscription(organization.id);
      
      if (result.hasSubscription && result.subscription) {
        setSubscriptionData({
          seats_total: result.subscription.seats_total,
          plan_type: result.subscription.plan_type,
          status: result.subscription.status,
          billing_frequency: result.subscription.billing_frequency,
          stripe_subscription_id: result.subscription.id
        });
      } else {
        // No subscription found
        setSubscriptionData(null);
      }

      // Load seats data from database
      await loadSeatsData();
    } catch (error) {
      console.error('Error loading billing info:', error);
      toast({
        title: "Error",
        description: "Failed to load billing information",
        variant: "destructive",
      });
      // Set to null if we can't load data
      setSubscriptionData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSeatsData = async () => {
    if (!organization?.id) return;
    
    try {
      const response = await fetch(`/api/organizations/seats?org_id=${organization.id}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch seats: ${response.statusText}`);
      }
      const data = await response.json();
      setSeatsData(data);
    } catch (error) {
      console.error('Error loading seats data:', error);
    }
  };

  const handleCreateSubscription = async () => {
    if (!organization?.id) return;

    try {
      setIsCreatingSubscription(true);
      const result = await createOrganizationSubscription({
        clerk_org_id: organization.id,
        plan_type: 'teams',
        billing_frequency: 'monthly',
        seats_total: 10,
      });

      if (result.success && result.checkout_url) {
        // Always redirect to Stripe checkout - no mock handling
        console.log('Redirecting to Stripe checkout:', result.checkout_url);
        window.location.href = result.checkout_url;
      } else {
        console.error('Subscription creation failed:', result);
        throw new Error(result.error || 'Failed to create subscription');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create subscription',
        variant: "destructive",
      });
    } finally {
      setIsCreatingSubscription(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    if (!organization?.id) return;

    try {
      setIsOpeningPortal(true);
      const result = await createOrganizationBillingPortal(organization.id);

      if (result.success) {
        if (result.url) {
          window.location.href = result.url;
        } else {
          // Development mode
          alert('Development Mode: Billing portal would open here. In production, this will redirect to organization billing portal.');
        }
      } else {
        throw new Error(result.error || 'Failed to open billing portal');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to open billing portal',
        variant: "destructive",
      });
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const handleInviteMember = async () => {
    if (!organization?.id || !newMemberEmail.trim()) return;
    
    if (availableSeats <= 0) {
      toast({
        title: "Cannot Send Invitation",
        description: "No available seats. Upgrade your subscription to add more members.",
        variant: "destructive",
      });
      return;
    }
  
    try {
      setIsInviting(true);
      
      const response = await fetch('/api/organizations/seats/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          org_id: organization.id,
          email: newMemberEmail,
          role: 'member',
        }),
      });
  
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to assign seat');
      }
  
      toast({
        title: "Seat Assigned!",
        description: `Seat assigned to ${newMemberEmail}. They can now access the organization.`,
      });
      
      setNewMemberEmail('');
      // Refresh data to show updated seat count
      await loadBillingInfo();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to assign seat',
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const getStatusBadge = (status: string = 'active') => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'past_due':
        return <Badge className="bg-yellow-600 text-white"><AlertTriangle className="w-3 h-3 mr-1" />Past Due</Badge>;
      case 'canceled':
        return <Badge className="bg-red-600 text-white"><AlertTriangle className="w-3 h-3 mr-1" />Canceled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatSeatUsage = (used: number, total: number): string => {
    return `${used}/${total} seats used`;
  };

  if (!isAdmin) {
    return (
      <Card className="bg-[#2a2a2a] border-white/10 p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto">
            <Settings className="w-8 h-8 text-gray-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Admin Access Required</h3>
            <p className="text-gray-400">
              Only organization administrators can view and manage billing settings.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-[#2a2a2a] border-white/10 p-6">
            <div className="space-y-4">
              <div className="h-6 bg-gray-600 rounded animate-pulse w-1/3"></div>
              <div className="h-4 bg-gray-600 rounded animate-pulse w-3/4"></div>
              <div className="h-4 bg-gray-600 rounded animate-pulse w-1/2"></div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!subscriptionData) {
    return (
      <Card className="bg-[#2a2a2a] border-white/10 p-6">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto">
            <CreditCard className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Set up Organization Billing</h3>
            <p className="text-gray-400 mb-6">
              Subscribe to a Teams plan to manage seats and billing for your organization.
            </p>
          </div>
          <div className="bg-[#1a1a1a] rounded-lg p-6 text-left max-w-md mx-auto">
            <h4 className="text-white font-medium mb-3">Teams Plan Features:</h4>
            <ul className="text-gray-400 space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                <span>Seat-based licensing (up to 100 seats)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                <span>Centralized billing and management</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                <span>Admin dashboard</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                <span>Priority support</span>
              </li>
            </ul>
          </div>
          <Button
            onClick={handleCreateSubscription}
            disabled={isCreatingSubscription}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isCreatingSubscription ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Subscribe to Teams Plan
              </>
            )}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Subscription Overview */}
      <Card className="bg-[#2a2a2a] border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Subscription Overview</h3>
          {getStatusBadge('active')}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-gray-400 mb-1">Plan</div>
            <div className="text-xl font-semibold text-white capitalize">Teams</div>
            <div className="text-sm text-gray-400">
              {formatSeatCost('teams', 'monthly', maxSeats)}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-400 mb-1">Seat Usage</div>
            <div className="text-xl font-semibold text-white">
              {formatSeatUsage(totalUsedSeats, maxSeats)}
            </div>
            <div className="text-xs text-gray-500 mb-2">
              {memberCount} members + {pendingInvitationsCount} pending
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  percentUsed > 80 ? 'bg-red-500' : percentUsed > 60 ? 'bg-yellow-500' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-400 mb-1">Next Payment</div>
            <div className="text-xl font-semibold text-white">
              {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </div>
            <div className="text-sm text-gray-400">monthly billing</div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            onClick={handleOpenBillingPortal}
            disabled={isOpeningPortal}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
          >
            {isOpeningPortal ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Opening...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                Manage Billing
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Current Members and Seats */}
      <Card className="bg-[#2a2a2a] border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Organization Members</h3>
          <div className="text-sm text-gray-400">
            {availableSeats} seats available
          </div>
        </div>

        <div className="space-y-3">
          {/* Active Members */}
          {memberships?.data?.map((membershipData) => (
            <div
              key={membershipData.id}
              className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  {membershipData.role === 'org:admin' ? (
                    <Crown className="w-4 h-4 text-white" />
                  ) : (
                    <Users className="w-4 h-4 text-white" />
                  )}
                </div>
                <div>
                  <div className="text-white font-medium">
                    {membershipData.publicUserData?.firstName} {membershipData.publicUserData?.lastName}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {membershipData.publicUserData?.identifier || 'No email available'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={membershipData.role === 'org:admin' ? 'default' : 'secondary'}
                  className={membershipData.role === 'org:admin' ? 'bg-blue-600 text-white' : ''}
                >
                  {membershipData.role === 'org:admin' ? 'Admin' : 'Member'}
                </Badge>
                <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">
                  Active
                </Badge>
              </div>
            </div>
          )) || []}

          {/* Pending Invitations */}
          {invitations?.data?.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg border border-yellow-500/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-white font-medium">{invitation.emailAddress}</div>
                  <div className="text-gray-400 text-sm">
                    Invited {new Date(invitation.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
                  Pending
                </Badge>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-gray-400 hover:text-red-400 p-1"
                    onClick={() => {
                      // Handle invitation revocation
                      toast({
                        title: "Feature Coming Soon",
                        description: "Invitation management will be available soon",
                      });
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          )) || []}
        </div>

        {/* Invite New Member */}
        {isAdmin && availableSeats > 0 && (
          <div className="mt-4 p-4 bg-[#1a1a1a] rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-blue-400" />
              <span className="text-white font-medium">Invite New Member</span>
            </div>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter email address"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                className="bg-[#2a2a2a] border-white/10 text-white placeholder-gray-500 flex-1"
                disabled={isInviting}
              />
              <Button
                onClick={handleInviteMember}
                disabled={isInviting || !newMemberEmail.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isInviting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Invite'
                )}
              </Button>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              This will consume 1 seat from your subscription
            </div>
          </div>
        )}

        {/* Seat Usage Warning */}
        {percentUsed > 80 && (
          <div className="mt-4 p-4 bg-yellow-600/10 border border-yellow-600/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-yellow-400 font-medium">Approaching Seat Limit</div>
                <div className="text-gray-400 text-sm">
                  You're using {memberCount} of {maxSeats} seats. Consider upgrading your plan to add more team members.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Available Seats Info */}
        {availableSeats > 0 && (
          <div className="mt-4 p-4 bg-[#1a1a1a] rounded-lg border border-dashed border-white/20">
            <div className="text-center text-gray-400">
              <Plus className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm">
                {availableSeats} more seats available for team members
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Invite new members through the Organization Settings tab
              </p>
            </div>
          </div>
        )}

        {/* No Seats Available */}
        {availableSeats === 0 && memberCount >= maxSeats && (
          <div className="mt-4 p-4 bg-red-600/10 border border-red-600/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div>
                <div className="text-red-400 font-medium">All Seats Used</div>
                <div className="text-gray-400 text-sm">
                  You've reached your seat limit. Upgrade your subscription to add more team members.
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Billing Actions */}
      <Card className="bg-[#2a2a2a] border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Billing Management</h3>
        </div>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-400">
            Manage your organization's subscription, billing information, and payment methods.
          </div>
          
          <div className="flex gap-3">
            <Button
              onClick={handleOpenBillingPortal}
              disabled={isOpeningPortal}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isOpeningPortal ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Opening Portal...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Billing Portal
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              disabled
            >
              <Settings className="w-4 h-4 mr-2" />
              Upgrade Plan
            </Button>
          </div>
          
          <div className="text-xs text-gray-500">
            Use the billing portal to update payment methods, view invoices, and manage your subscription.
          </div>
        </div>
      </Card>
    </div>
  );
};