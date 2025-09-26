import { useEffect, useState } from 'react';
import { useOrganization, useUser } from '@clerk/nextjs';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { useOrganizationSeats } from '@/hooks/useOrganizationSeats';
import { formatPrice } from '@/utils/currency';
import { getOrganizationSubscription, createOrganizationSubscription, createOrganizationBillingPortal } from '@/utils/organization/billing';

interface BillingDashboardProps {
  className?: string;
}

export const BillingDashboard = ({ className }: BillingDashboardProps) => {
  const { organization, membership, memberships, invitations } = useOrganization();
  const { user } = useUser();
  const { toast } = useToast();
  const { seats, usages, loading, assignSeat, revokeSeat, isValidSeat } = useOrganizationSeats();

  const [subscriptionData, setSubscriptionData] = useState<{
    seats_total: number;
    plan_type: string;
    status: string;
    billing_frequency: string;
    stripe_subscription_id: string | null;
  } | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');

  const isAdmin = membership?.role === 'admin';
  const totalUsedSeats = memberships?.count || 0;
  const maxSeats = subscriptionData?.seats_total || 0;
  const availableSeats = Math.max(0, maxSeats - totalUsedSeats);
  const hasOverage = usages.some(u => u.overage);

  useEffect(() => {
    if (organization?.id) {
      loadBillingInfo();
    }
  }, [organization?.id, memberships?.count]);

  const loadBillingInfo = async () => {
    if (!organization?.id) return;

    try {
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
        setSubscriptionData(null);
      }
    } catch (error) {
      console.error('Error loading billing info:', error);
      toast({
        title: "Error",
        description: "Failed to load billing information",
        variant: "destructive",
      });
    }
  };

  const handleCreateSubscription = async () => {
    if (!organization?.id) return;

    try {
      setIsOpeningPortal(true);
      const result = await createOrganizationSubscription({
        clerk_org_id: organization.id,
        plan_type: 'teams',
        billing_frequency: 'monthly',
        seats_total: 10, // Default starter seats
      });

      if ('error' in result) {
        console.error('Subscription creation failed:', result);
        throw new Error(result.error || 'Failed to create subscription');
      }

      toast({
        title: "Success",
        description: "Subscription created. Redirecting to payment...",
      });
      loadBillingInfo();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create subscription',
        variant: "destructive",
      });
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    if (!organization?.id) return;

    try {
      setIsOpeningPortal(true);
      const result = await createOrganizationBillingPortal(organization.id);

      if ('error' in result) {
        throw new Error(result.error || 'Failed to open billing portal');
      }

      if (result.url) {
        window.location.href = result.url;
      } else {
        // Development mode mock
        alert('Development Mode: Billing portal would open here. In production, this will redirect to organization billing portal.');
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
      // Use enhanced invitation with seat check
      // await sendInvitation(newMemberEmail, organization.id, user.id);
      // For demo, simulate
      await assignSeat(newMemberEmail);
      setNewMemberEmail('');
      toast({
        title: "Invitation Sent",
        description: "Invitation sent and seat assigned.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive",
      });
    }
  };

  const handleRevokeSeat = async (clerkUserId: string) => {
    try {
      await revokeSeat(clerkUserId);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to revoke seat",
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold text-white mb-2">
          Admin Access Required
        </h3>
        <p className="text-gray-400">
          Only organization administrators can view billing settings.
        </p>
      </div>
    );
  }

  if (!subscriptionData) {
    return (
      <div className="p-6">
        <Card className="bg-[#2a2a2a] border-white/10">
          <CardContent className="p-6">
            <h3 className="text-xl font-semibold text-white mb-4">No Subscription</h3>
            <p className="text-gray-400 mb-6">
              Subscribe to a Teams plan to manage seats and billing for your organization.
            </p>
            <ul className="text-gray-400 space-y-2 mb-6">
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0 mr-2" />
                <span>Seat-based licensing (up to 100 seats)</span>
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0 mr-2" />
                <span>Centralized billing and management</span>
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0 mr-2" />
                <span>Usage tracking and overage billing</span>
              </li>
            </ul>
            <Button onClick={handleCreateSubscription} className="bg-blue-600 hover:bg-blue-700 w-full">
              Create Teams Subscription
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subscription Overview */}
      <Card className="bg-[#2a2a2a] border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Subscription Overview</CardTitle>
          <CardDescription className="text-gray-400">
            Manage your organization's {subscriptionData.plan_type} plan ({subscriptionData.billing_frequency}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-400">Status</p>
              <Badge className={subscriptionData.status === 'active' ? 'bg-green-600' : 'bg-red-600'}>
                {subscriptionData.status}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Seats</p>
              <p className="text-white font-medium">{maxSeats}</p>
            </div>
          </div>
          <Button onClick={handleOpenBillingPortal} disabled={isOpeningPortal} className="w-full bg-blue-600 hover:bg-blue-700">
            {isOpeningPortal ? 'Opening...' : 'Manage Billing'}
          </Button>
        </CardContent>
      </Card>

      {/* Seat Management Section */}
      <Card className="bg-[#2a2a2a] border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Seats</CardTitle>
          <CardDescription className="text-gray-400">
            Current usage: {totalUsedSeats}/{maxSeats} seats used
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasOverage && (
            <Alert className="bg-yellow-900/20 border-yellow-500/30">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-300">
                Overage detected. Additional charges will be applied to your next invoice.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-sm text-gray-400">Available Seats</p>
              <Badge className={availableSeats > 0 ? 'bg-green-600' : 'bg-red-600'}>
                {availableSeats}
              </Badge>
            </div>
            <Button onClick={() => handleOpenBillingPortal()} className="bg-blue-600 hover:bg-blue-700">
              Upgrade Seats
            </Button>
          </div>
          <div className="space-y-2">
            {seats.map((seat) => (
              <div key={seat.id} className="flex justify-between items-center p-3 bg-[#1a1a1a] rounded-lg">
                <div>
                  <p className="text-white font-medium">{seat.user_email}</p>
                  <p className="text-sm text-gray-400">Status: {seat.status}</p>
                </div>
                {seat.status === 'active' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevokeSeat(seat.clerk_user_id)}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Member email"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              className="flex-1 bg-[#1a1a1a] border-white/10 text-white placeholder-gray-400 rounded-md px-3 py-2"
            />
            <Button onClick={handleInviteMember} disabled={availableSeats <= 0 || !newMemberEmail.trim()}>
              Invite Member
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Usage Tracking */}
      <Card className="bg-[#2a2a2a] border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Usage Tracking</CardTitle>
          <CardDescription className="text-gray-400">
            Monitor feature usage and overages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {usages.map((usage) => (
              <div key={usage.id} className="flex justify-between items-center p-3 bg-[#1a1a1a] rounded">
                <div>
                  <p className="text-white">{usage.feature}</p>
                  <p className="text-sm text-gray-400">Period: {new Date(usage.period_start).toLocaleDateString()} - {new Date(usage.period_end).toLocaleDateString()}</p>
                </div>
                <Badge className={usage.overage ? 'bg-red-600' : 'bg-green-600'}>
                  {usage.usage_count} {usage.overage ? '(Overage)' : ''}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};