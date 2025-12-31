import { useState, useEffect } from 'react';
import { useOrganization, useAuth } from '@clerk/clerk-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard,
  Settings,
  Plus,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ExternalLink,
  Clock,
  RefreshCw,
} from 'lucide-react';
import {
  createOrganizationBillingPortal,
  createOrganizationSubscription,
  getOrganizationSubscription,
  formatSeatCost,
  getOrgCredits,
  createOrgCreditTopup,
  formatOrgCreditUsage,
  updateSubscriptionQuantity,
} from '@/utils/organization/billing';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BillingDashboardProps {
  className?: string;
}

export const BillingDashboard = ({ className }: BillingDashboardProps) => {
  const { organization, membership, memberships, invitations } = useOrganization();
  const { getToken } = useAuth();
  const { toast } = useToast();
  
  const [subscriptionData, setSubscriptionData] = useState<{
    seats_total: number;
    plan_type: string;
    status: string;
    billing_frequency: string;
    stripe_subscription_id: string | null;
    trial_end?: number | null;
    trial_start?: number | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState(5);
  const [orgCredits, setOrgCredits] = useState(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [isUpdatingSeats, setIsUpdatingSeats] = useState(false);
  const [newSeatCount, setNewSeatCount] = useState(0);
  const [isSeatDialogOpen, setIsSeatDialogOpen] = useState(false);

  const isAdmin = membership?.role === 'org:admin';
  // Use organization.membersCount for more accurate count as per Clerk docs
  const memberCount = organization?.membersCount || memberships?.count || 0;
  const pendingInvitationsCount = organization?.pendingInvitationsCount || invitations?.count || 0;
  
  // Use Clerk data for seat usage
  const totalUsedSeats = memberCount + pendingInvitationsCount;
  const maxSeats = subscriptionData?.seats_total || 0;
  const availableSeats = Math.max(0, maxSeats - totalUsedSeats);
  const percentUsed = maxSeats > 0 ? Math.round((totalUsedSeats / maxSeats) * 100) : 0;

  useEffect(() => {
    if (organization?.id) {
      loadBillingInfo();
    }
  }, [organization?.id, organization?.membersCount, memberships?.count]);

  const loadBillingInfo = async () => {
    if (!organization?.id) return;
    
    try {
      setIsLoading(true);
      
      // Get authentication token
      const token = await getToken();
      console.log('🔍 DEBUG: Got auth token for subscription call:', token ? 'Present' : 'Missing');
      
      // Fetch real subscription data from Stripe
      const result = await getOrganizationSubscription(organization.id, token);
      
      if (result.hasSubscription && result.subscription) {
        setSubscriptionData({
          seats_total: result.subscription.seats_total,
          plan_type: result.subscription.plan_type,
          status: result.subscription.status,
          billing_frequency: result.subscription.billing_frequency,
          stripe_subscription_id: result.subscription.id,
          trial_end: result.subscription.trial_end,
          trial_start: result.subscription.trial_start,
        });
      } else {
        // No subscription found
        setSubscriptionData(null);
      }

    } catch (error) {
      console.error('Error loading billing info:', error);
      // Set to null if we can't load data
      setSubscriptionData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrgCredits = async () => {
    if (!organization?.id || !subscriptionData) return;
    
    try {
      setIsLoadingCredits(true);
      const credits = await getOrgCredits(organization.id);
      setOrgCredits(credits);
    } catch (error) {
      console.error('Error loading organization credits:', error);
      toast({
        title: "Error",
        description: "Failed to load organization credits",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCredits(false);
    }
  };

  const handleCreateSubscription = async () => {
    if (!organization?.id) return;

    try {
      setIsCreatingSubscription(true);
      const token = await getToken();
      console.log('🔍 DEBUG: Got auth token for create subscription:', token ? 'Present' : 'Missing');
      
      const result = await createOrganizationSubscription({
        clerk_org_id: organization.id,
        plan_type: 'teams',
        billing_frequency: 'monthly',
        seats_total: selectedSeats,
      }, token);

      if (result.success && result.checkout_url) {
        // Always redirect to Stripe checkout - no mock handling
        console.log('🔍 DEBUG: Redirecting to Stripe checkout:', result.checkout_url);
        console.log('🔍 DEBUG: Checkout URL contains mock:', result.checkout_url.includes('mock'));
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

  const handleTopupCredits = async () => {
    if (!organization?.id) return;

    const creditsToAdd = prompt('How many credits would you like to add?');
    if (!creditsToAdd || isNaN(Number(creditsToAdd)) || Number(creditsToAdd) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid number of credits",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsToppingUp(true);
      const token = await getToken();
      const result = await createOrgCreditTopup(organization.id, Number(creditsToAdd), token);

      if (result.success && result.checkout_url) {
        window.location.href = result.checkout_url;
      } else {
        throw new Error(result.error || 'Failed to create top-up session');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create top-up session',
        variant: "destructive",
      });
    } finally {
      setIsToppingUp(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    if (!organization?.id) return;

    try {
      setIsOpeningPortal(true);
      const token = await getToken();
      console.log('🔍 Dashboard: Got token for billing portal:', !!token);
      const result = await createOrganizationBillingPortal(organization.id, token);

      if (result.success) {
        if (result.url) {
          console.log('🔍 Dashboard: Redirecting to billing portal:', result.url);
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

  const handleUpdateSeats = async () => {
    if (!organization?.id || newSeatCount < 1) return;

    try {
      setIsUpdatingSeats(true);
      const result = await updateSubscriptionQuantity(organization.id, newSeatCount);

      if (result.success) {
        toast({
          title: "Seats Updated",
          description: `Successfully updated to ${newSeatCount} seats.`,
        });
        setIsSeatDialogOpen(false);
        await loadBillingInfo();
      } else {
        throw new Error(result.error || 'Failed to update seats');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update seats',
        variant: "destructive",
      });
    } finally {
      setIsUpdatingSeats(false);
    }
  };

  const getStatusBadge = (status: string = 'active') => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600 text-white"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-600 text-white"><Clock className="w-3 h-3 mr-1" />Trialing</Badge>;
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
                <span>Seat-based licensing (up to 100 seats, $30/month per seat)</span>
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

            {/* Seat Selection */}
            <div className="mt-6 space-y-3">
              <label className="text-white font-medium block mb-2">Number of Seats</label>
              <Input
                type="number"
                min="1"
                max="100"
                value={selectedSeats}
                onChange={(e) => setSelectedSeats(parseInt(e.target.value) || 1)}
                className="bg-[#2a2a2a] border-white/10 text-white placeholder-gray-500 w-full"
                placeholder="Enter number of seats (1-100)"
              />
              <div className="text-sm text-gray-400">
                Total: {formatSeatCost('teams', 'monthly', selectedSeats)} ({selectedSeats} seats)
              </div>
            </div>
          </div>
          <Button
            onClick={handleCreateSubscription}
            disabled={isCreatingSubscription || !selectedSeats || selectedSeats < 1 || selectedSeats > 100}
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
          {getStatusBadge(subscriptionData?.status)}
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
          
  
          {/* Trial Status */}
          {subscriptionData?.status === 'trialing' && subscriptionData.trial_end && (
            <div className="mt-4 p-3 bg-blue-600/10 border border-blue-600/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <div>
                  <div className="text-blue-300 font-medium">14-Day Trial Active</div>
                  <div className="text-sm text-blue-200">
                    Trial ends on {new Date(subscriptionData.trial_end).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Organization Credit Pool */}
        {orgCredits && (
          <div className="mt-6 p-4 bg-[#1a1a1a] rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="space-y-1">
                <h4 className="text-white font-medium">Organization Credit Pool</h4>
                <p className="text-xs text-gray-400">Shared by all team members with an active seat.</p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {orgCredits.remaining_credits} remaining
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-400">Total Credits</div>
                <div className="text-white font-medium">{orgCredits.total_credits}</div>
              </div>
              <div>
                <div className="text-gray-400">Used</div>
                <div className="text-white font-medium">{orgCredits.used_credits}</div>
              </div>
              <div>
                <div className="text-gray-400">Remaining</div>
                <div className="text-white font-medium">{orgCredits.remaining_credits}</div>
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
              <div
                className="h-2 rounded-full bg-blue-600"
                style={{ width: `${(orgCredits.used_credits / orgCredits.total_credits * 100) || 0}%` }}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleTopupCredits}
                disabled={isToppingUp}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isToppingUp ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Top-up Credits
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={() => loadOrgCredits()}
                disabled={isLoadingCredits}
              >
                {isLoadingCredits ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        )}

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


    </div>
  );
};