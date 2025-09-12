import { useState, useEffect } from 'react';
import { useOrganization } from '@clerk/clerk-react';
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
} from 'lucide-react';
import { OrganizationBillingInfo } from '@/types/organization';
import {
  getOrganizationBilling,
  createOrganizationBillingPortal,
  createOrganizationSubscription,
  assignSeatToMember,
  removeSeatFromMember,
  formatSeatUsage,
  formatSeatCost,
} from '@/utils/organization/billing';

interface BillingDashboardProps {
  className?: string;
}

export const BillingDashboard = ({ className }: BillingDashboardProps) => {
  const { organization, membership } = useOrganization();
  const { toast } = useToast();
  
  const [billingInfo, setBillingInfo] = useState<OrganizationBillingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const isAdmin = membership?.role === 'org:admin';

  useEffect(() => {
    if (organization?.id) {
      loadBillingInfo();
    }
  }, [organization?.id]);

  const loadBillingInfo = async () => {
    if (!organization?.id) return;
    
    try {
      setIsLoading(true);
      const info = await getOrganizationBilling(organization.id);
      setBillingInfo(info);
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

  const getStatusBadge = (status: string) => {
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

  if (!billingInfo?.subscription) {
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
          {getStatusBadge(billingInfo.subscription.status)}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-gray-400 mb-1">Plan</div>
            <div className="text-xl font-semibold text-white capitalize">
              {billingInfo.subscription.plan_type}
            </div>
            <div className="text-sm text-gray-400">
              {formatSeatCost(
                billingInfo.subscription.plan_type,
                billingInfo.subscription.billing_frequency,
                billingInfo.subscription.seats_total
              )}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-400 mb-1">Seat Usage</div>
            <div className="text-xl font-semibold text-white">
              {formatSeatUsage(billingInfo.seatUsage.used, billingInfo.seatUsage.total)}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${billingInfo.seatUsage.percentUsed}%` }}
              />
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-400 mb-1">Next Payment</div>
            <div className="text-xl font-semibold text-white">
              {new Date(billingInfo.subscription.current_period_end).toLocaleDateString()}
            </div>
            <div className="text-sm text-gray-400">
              {billingInfo.subscription.billing_frequency} billing
            </div>
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

      {/* Seat Management */}
      <Card className="bg-[#2a2a2a] border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Seat Management</h3>
          <div className="text-sm text-gray-400">
            {billingInfo.seatUsage.available} seats available
          </div>
        </div>

        <div className="space-y-3">
          {billingInfo.seats.map((seat) => (
            <div
              key={seat.id}
              className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-white font-medium">{seat.user_name}</div>
                  <div className="text-gray-400 text-sm">{seat.user_email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  Assigned {new Date(seat.assigned_at).toLocaleDateString()}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {billingInfo.seatUsage.available > 0 && (
          <div className="mt-4 p-4 bg-[#1a1a1a] rounded-lg border border-dashed border-white/20">
            <div className="text-center text-gray-400">
              <Plus className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm">
                {billingInfo.seatUsage.available} more seats available for team members
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};