import { useUser, useAuth } from '@clerk/clerk-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  DollarSign,
  Receipt,
  TrendingUp,
  AlertTriangle,
  Download,
  Plus,
  Minus,
  History,
  BarChart3,
  Loader2,
  CreditCard,
  ExternalLink,
  RefreshCw,
  Package,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { createStripeCustomerPortalSession } from '@/api/stripe';

interface Subscription {
  id: string;
  planType: string;
  billingFrequency: string;
  status: string;
  totalCredits: number;
  usedCredits: number;
  availableCredits: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  lastCreditRechargeAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreditTransaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  created_at: string;
  reference_id: string | null;
}

export const PersonalBilling = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Subscription state
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);

  // Fetch subscription data on component mount
  useEffect(() => {
    if (user?.id) {
      fetchSubscriptionData();
    }
  }, [user?.id]);

  const fetchSubscriptionData = async () => {
    if (!user?.id) return;

    setIsLoadingSubscription(true);
    try {
      const token = await getToken({ template: "supabase" });
      const response = await fetch(`/api/user/subscription?clerkUserId=${user.id}`, {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch subscription data');
      }

      const data = await response.json();
      
      if (data.success) {
        setHasSubscription(data.hasSubscription);
        if (data.subscription) {
          setSubscription(data.subscription);
        }
        if (data.transactions) {
          setTransactions(data.transactions);
        }
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      toast({
        title: "Error",
        description: "Failed to load subscription data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  const formatCurrency = (amount: number, currency = 'EUR') => {
    return new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getPlanDisplayName = (planType: string) => {
    const planNames: Record<string, string> = {
      starter: 'Starter',
      basic: 'Basic',
      pro: 'Pro',
      enterprise: 'Enterprise',
    };
    return planNames[planType] || planType;
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400 border-green-500/30',
      trialing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      past_due: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      canceled: 'bg-red-500/20 text-red-400 border-red-500/30',
      unpaid: 'bg-red-500/20 text-red-400 border-red-500/30',
      incomplete: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      paused: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    };
    return colors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getMonthlyCost = () => {
    if (!subscription) return 0;
    // Based on plan type and billing frequency
    const basePrices: Record<string, number> = {
      starter: 0,
      basic: 7,
      pro: 19,
      enterprise: 49,
    };
    const price = basePrices[subscription.planType] || 0;
    return subscription.billingFrequency === 'yearly' ? price * 10 : price; // Yearly gets 2 months free
  };

  const handleCreditTopup = async (creditsAmount: number) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const token = await getToken({ template: "supabase" });
      const baseUrl = window.location.origin;
      const response = await fetch('/api/stripe/create-credit-topup-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          creditsAmount,
          clerkUserId: user.id,
          successUrl: `${baseUrl}/payment/success`,
          cancelUrl: `${baseUrl}/billing`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create top-up session');
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Error creating credit top-up:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create top-up session',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    if (!user?.id) return;

    try {
      setIsOpeningPortal(true);
      const result = await createStripeCustomerPortalSession(user.id);

      if (result.success) {
        if (result.url) {
          window.location.href = result.url;
        } else if ('mock' in result && result.mock && import.meta.env.DEV) {
          toast({
            title: "Development Mode",
            description: "Billing portal would redirect in production. Using mock implementation.",
          });
        } else {
          throw new Error('No portal URL received');
        }
      } else {
        throw new Error('error' in result ? result.error : 'Failed to create portal session');
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSubscriptionData();
    setIsRefreshing(false);
    toast({
      title: "Refreshed",
      description: "Subscription data updated",
    });
  };

  if (isLoadingSubscription) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const availableCredits = subscription?.availableCredits || 0;
  const monthlyCost = getMonthlyCost();

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 bg-[#2a2a2a] border-white/10">
        <TabsTrigger
          value="overview"
          className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-400"
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          Overview
        </TabsTrigger>
        <TabsTrigger
          value="credits"
          className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-400"
        >
          <DollarSign className="w-4 h-4 mr-2" />
          Credits
        </TabsTrigger>
        <TabsTrigger
          value="invoices"
          className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-400"
        >
          <Receipt className="w-4 h-4 mr-2" />
          Invoices
        </TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Credit Balance Card */}
          <Card className="bg-[#2a2a2a] border-white/10 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Credit Balance</span>
              <DollarSign className="w-4 h-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {availableCredits.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">
              credits available
            </div>
            {availableCredits < 100 && (
              <div className="mt-2 flex items-center gap-2 text-yellow-400 text-xs">
                <AlertTriangle className="w-3 h-3" />
                Low balance warning
              </div>
            )}
          </Card>

          {/* Current Plan Card */}
          <Card className="bg-[#2a2a2a] border-white/10 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Current Plan</span>
              <Package className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {hasSubscription && subscription ? getPlanDisplayName(subscription.planType) : 'No Plan'}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {hasSubscription && subscription ? (
                <span className={`px-2 py-0.5 text-xs rounded border ${getStatusBadgeColor(subscription.status)}`}>
                  {subscription.status}
                </span>
              ) : (
                <span className="text-xs text-gray-400">Subscribe to get started</span>
              )}
            </div>
          </Card>

          {/* Next Payment Card */}
          <Card className="bg-[#2a2a2a] border-white/10 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Next Payment</span>
              <CreditCard className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-white mb-1">
              {hasSubscription && subscription?.status === 'active' 
                ? formatCurrency(monthlyCost)
                : formatCurrency(0)
              }
            </div>
            <div className="text-xs text-gray-400">
              {subscription?.currentPeriodEnd 
                ? formatDate(subscription.currentPeriodEnd)
                : 'No active subscription'
              }
            </div>
          </Card>
        </div>

        {/* Subscription Details */}
        {hasSubscription && subscription && (
          <Card className="bg-[#2a2a2a] border-white/10 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Subscription Details</h3>
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-400">Plan Type</div>
                <div className="text-white font-medium capitalize">{subscription.planType}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Billing Frequency</div>
                <div className="text-white font-medium capitalize">{subscription.billingFrequency}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Current Period Start</div>
                <div className="text-white font-medium">{formatDate(subscription.currentPeriodStart)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Current Period End</div>
                <div className="text-white font-medium">{formatDate(subscription.currentPeriodEnd)}</div>
              </div>
              {subscription.lastCreditRechargeAt && (
                <div>
                  <div className="text-sm text-gray-400">Last Credit Recharge</div>
                  <div className="text-white font-medium">{formatDate(subscription.lastCreditRechargeAt)}</div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="bg-[#2a2a2a] border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setActiveTab('credits')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Buy Credits
            </Button>
            <Button 
              variant="outline" 
              className="border-white/20 text-white hover:bg-white/10"
              onClick={handleOpenBillingPortal}
              disabled={isOpeningPortal}
            >
              {isOpeningPortal ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Manage Subscription
            </Button>
            <Button 
              variant="outline" 
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => setActiveTab('invoices')}
            >
              <History className="w-4 h-4 mr-2" />
              View History
            </Button>
          </div>
        </Card>
      </TabsContent>

      {/* Credits Tab */}
      <TabsContent value="credits" className="mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Credit Purchase Form */}
          <Card className="bg-[#2a2a2a] border-white/10 p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-white">Buy Credits</h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-blue-600/20 hover:border-blue-500 p-4 h-auto flex flex-col items-center gap-1"
                  onClick={() => handleCreditTopup(500)}
                  disabled={isLoading}
                >
                  <div className="text-sm font-medium">500 credits</div>
                  <div className="text-lg font-bold text-green-400">€7.00</div>
                </Button>
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-blue-600/20 hover:border-blue-500 p-4 h-auto flex flex-col items-center gap-1"
                  onClick={() => handleCreditTopup(1000)}
                  disabled={isLoading}
                >
                  <div className="text-sm font-medium">1,000 credits</div>
                  <div className="text-lg font-bold text-green-400">€14.00</div>
                </Button>
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-blue-600/20 hover:border-blue-500 p-4 h-auto flex flex-col items-center gap-1"
                  onClick={() => handleCreditTopup(2500)}
                  disabled={isLoading}
                >
                  <div className="text-sm font-medium">2,500 credits</div>
                  <div className="text-lg font-bold text-green-400">€35.00</div>
                </Button>
              </div>

              <div className="pt-4 border-t border-white/10 space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Custom amount (credits)"
                    className="bg-[#2a2a2a] border-white/10 text-white placeholder-gray-500 flex-1"
                    disabled={isLoading}
                  />
                  <Button
                    onClick={() => {
                      const customAmount = prompt('Enter number of credits to purchase:');
                      if (customAmount && !isNaN(Number(customAmount)) && Number(customAmount) > 0) {
                        handleCreditTopup(Number(customAmount));
                      }
                    }}
                    disabled={isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex-0"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Buy Custom
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Credit Usage Summary */}
          <Card className="bg-[#2a2a2a] border-white/10 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-green-500" />
              <h3 className="text-lg font-semibold text-white">Usage Summary</h3>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total Credits</span>
                <span className="text-white font-medium">{subscription?.totalCredits?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Used Credits</span>
                <span className="text-red-400 font-medium">{subscription?.usedCredits?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Available Credits</span>
                <span className="text-green-400 font-medium">{availableCredits.toLocaleString()}</span>
              </div>

              <div className="pt-4 border-t border-white/10">
                <div className="text-sm text-gray-400">
                  Rate: 1 credit = €0.014
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Credits are automatically granted monthly based on your plan
                </div>
              </div>
            </div>
          </Card>
        </div>
      </TabsContent>

      {/* Invoices Tab */}
      <TabsContent value="invoices" className="mt-6">
        <Card className="bg-[#2a2a2a] border-white/10 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Transaction History</h3>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No transactions yet</p>
              <p className="text-sm mt-1">Your credit transactions will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 bg-[#1a1a1a] rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      transaction.amount > 0 ? 'bg-green-600' : 'bg-red-600'
                    }`}>
                      {transaction.amount > 0 ? (
                        <Plus className="w-4 h-4 text-white" />
                      ) : (
                        <Minus className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="text-white font-medium">{transaction.description}</div>
                      <div className="text-gray-400 text-sm">{formatDate(transaction.created_at)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-medium ${
                      transaction.amount > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {transaction.amount > 0 ? '+' : ''}{transaction.amount} credits
                    </div>
                    {transaction.reference_id && (
                      <div className="text-gray-400 text-xs">ID: {transaction.reference_id}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </TabsContent>
    </Tabs>
  );
};