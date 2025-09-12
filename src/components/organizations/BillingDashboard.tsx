import { useState, useEffect } from 'react';
import { useOrganization, useOrganizationList } from '@clerk/clerk-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import {
  createOrganizationBillingPortal,
  createOrganizationSubscription,
  formatSeatCost,
} from '@/utils/organization/billing';

interface BillingDashboardProps {
  className?: string;
}

export const BillingDashboard = ({ className }: BillingDashboardProps) => {
  const { organization, membership, memberships } = useOrganization();
  const { toast } = useToast();
  
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const isAdmin = membership?.role === 'org:admin';
  const memberCount = memberships?.count || 0;
  const maxSeats = 10; // This would come from actual subscription data
  const availableSeats = Math.max(0, maxSeats - memberCount);
  const percentUsed = maxSeats > 0 ? Math.round((memberCount / maxSeats) * 100) : 0;

  useEffect(() => {
    if (organization?.id) {
      loadBillingInfo();
    }
  }, [organization?.id, memberships?.count]);

  const loadBillingInfo = async () => {
    if (!organization?.id) return;
    
    try {
      setIsLoading(true);
      // In production, this would check if organization has an active subscription
      // For demo purposes, we'll assume organizations have subscriptions
      setHasSubscription(!!organization.id);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load billing information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
        if (result.checkout_url.includes('mock=true')) {
          toast({
            title: "Success!",
            description: "Mock subscription created for development",
          });
          await loadBillingInfo();
        } else {
          window.location.href = result.checkout_url;
        }
      } else {
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

  if (!hasSubscription) {
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
                <span>Admin dashboard with analytics</span>
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
              {formatSeatUsage(memberCount, maxSeats)}
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
                <Badge variant="outline" className="text-xs border-white/20 text-gray-400">
                  Seat Assigned
                </Badge>
              </div>
            </div>
          )) || []}
        </div>

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