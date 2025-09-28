import { useUser, UserButton, useAuth, useOrganization, OrganizationSwitcher, OrganizationProfile } from '@clerk/clerk-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Settings,
  Search,
  Bell,
  Users,
  Home,
  Code,
  CreditCard,
  FileText,
  Mail,
  Building,
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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { setAuthPageMeta } from '@/utils/seo';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { BillingDashboard } from '@/components/organizations/BillingDashboard';

// Dark theme appearance configuration for Clerk components
const clerkAppearance = {
  elements: {
    card: "bg-[#2a2a2a] border-white/10 text-white",
    headerTitle: "text-white",
    headerSubtitle: "text-gray-400",
    socialButtonsBlockButton: "bg-[#1a1a1a] border-white/10 text-white hover:bg-white/10",
    formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
    formFieldInput: "bg-[#1a1a1a] border-white/10 text-white placeholder-gray-500",
    footerActionText: "text-gray-400",
    footerActionLink: "text-blue-400 hover:text-blue-300",
    dividerLine: "bg-white/10",
    dividerText: "text-gray-400",
    modalContent: "bg-[#2a2a2a]",
    modalCloseButton: "text-gray-400 hover:text-white",
    organizationSwitcherTrigger: "bg-transparent border-white/10 text-white hover:bg-white/10",
    organizationSwitcherTriggerIcon: "text-gray-400",
    organizationPreview: "text-white",
    organizationPreviewAvatarBox: "border-white/10"
  },
  variables: {
    colorBackground: "#2a2a2a",
    colorInputBackground: "#1a1a1a",
    colorInputText: "#ffffff",
    colorPrimary: "#2563eb",
    colorText: "#ffffff",
    colorTextSecondary: "#9ca3af"
  }
};

// Mock data for credit transactions
const mockCreditTransactions = [
  {
    id: '1',
    amount: 500,
    type: 'grant',
    description: 'Credit purchase',
    created_at: '2024-01-15T10:30:00Z',
    reference_id: 'pi_1234567890'
  },
  {
    id: '2',
    amount: -50,
    type: 'usage',
    description: 'VSCode extension usage',
    created_at: '2024-01-14T15:45:00Z',
    reference_id: null
  },
  {
    id: '3',
    amount: 1000,
    type: 'grant',
    description: 'Welcome bonus',
    created_at: '2024-01-10T09:00:00Z',
    reference_id: null
  }
];

const Billing = () => {
  const { user } = useUser();
  const { organization, isLoaded: orgLoaded, membership } = useOrganization();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [currentBalance, setCurrentBalance] = useState(1250);
  const [isLoading, setIsLoading] = useState(false);

  const isAdmin = membership?.role === 'org:admin';

  useEffect(() => {
    setAuthPageMeta('billing');
  }, []);

  // Set default tab based on admin status and organization
  useEffect(() => {
    if (organization && isAdmin) {
      setActiveTab('organization');
    } else {
      setActiveTab('overview');
    }
  }, [organization, isAdmin]);

  const formatCurrency = (amount: number, currency = 'EUR') => {
    return new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <SidebarProvider>
        {/* Sidebar */}
        <Sidebar className="border-r border-[#2a2a2a] bg-[#161616]">
          <SidebarHeader className="p-4 border-b border-[#2a2a2a]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Code className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-white">Softcodes</span>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-4">
            {/* Organization Switcher */}
            <div className="mb-6">
              {!orgLoaded ? (
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-5 h-5 bg-gray-600 rounded-sm animate-pulse"></div>
                  <div className="h-4 bg-gray-600 rounded animate-pulse flex-1"></div>
                  <div className="w-4 h-4 bg-gray-600 rounded animate-pulse"></div>
                </div>
              ) : (
                <div className="clerk-organization-switcher">
                  <OrganizationSwitcher
                    appearance={{
                      ...clerkAppearance,
                      elements: {
                        ...clerkAppearance.elements,
                        organizationSwitcherTrigger: "w-full justify-start bg-transparent border-white/10 text-white hover:bg-white/10 p-2 rounded-md",
                        organizationSwitcherTriggerIcon: "text-gray-400 ml-auto",
                        organizationPreview: "text-white",
                        organizationPreviewAvatarBox: "w-5 h-5 border-white/10",
                        organizationPreviewMainIdentifier: "text-sm text-white/70"
                      }
                    }}
                    organizationProfileMode="modal"
                    organizationProfileProps={{
                      appearance: clerkAppearance
                    }}
                    createOrganizationMode="modal"
                    afterCreateOrganizationUrl="/billing"
                    afterLeaveOrganizationUrl="/billing"
                    afterSelectOrganizationUrl="/billing"
                    hidePersonal={false}
                  />
                </div>
              )}
            </div>

            {/* Navigation Menu */}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Link to="/dashboard">
                    <Home className="w-4 h-4" />
                    <span>Dashboard</span>
                    <SidebarMenuBadge></SidebarMenuBadge>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive
                  className="bg-blue-600/20 text-white"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Billing</span>
                  <SidebarMenuBadge></SidebarMenuBadge>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className={`${organization ? 'bg-blue-600/20 text-white' : 'text-white/70'} hover:text-white hover:bg-white/10`}
                >
                  <Link to="/organizations">
                    <Users className="w-4 h-4" />
                    <span>{organization ? organization.name : 'Organizations'}</span>
                    <SidebarMenuBadge>{organization ? '1' : ''}</SidebarMenuBadge>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

            </SidebarMenu>

            <SidebarSeparator className="my-6 bg-[#2a2a2a]" />

            {/* Support Section */}
            <div className="mb-6">
              <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">
                SUPPORT
              </div>
              <SidebarMenu>

                <SidebarMenuItem>
                  <SidebarMenuButton className="text-white/70 hover:text-white hover:bg-white/10">
                    <FileText className="w-4 h-4" />
                    <span>Docs</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton className="text-white/70 hover:text-white hover:bg-white/10">
                    <Mail className="w-4 h-4" />
                    <span>Contact Support</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-[#2a2a2a]">
            <div className="bg-[#2a2a2a] rounded-lg p-4 border border-[#2a2a2a]">
              <div className="text-sm font-medium text-white mb-1">Upgrade to Pro</div>
              <div className="text-xs text-white/70 mb-3">
                Unlock unlimited credits, advanced analytics, and priority support.
              </div>
              <div className="text-lg font-bold text-white mb-2">$29<span className="text-sm font-normal text-white/70">/month</span></div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Upgrade Now
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content */}
        <SidebarInset className="bg-[#121212]">
          {/* Header */}
          <header className="border-b border-white/10 bg-[#1a1a1a]/50 backdrop-blur-sm">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-gray-400 hover:text-white" />
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span>Account</span>
                  <span>{'>'}</span>
                  <span className="text-white">Billing</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search billing history..."
                    className="pl-10 w-80 bg-[#2a2a2a] border-white/10 text-white placeholder-gray-400"
                  />
                </div>

                {/* Credits Balance */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 hidden sm:inline">{currentBalance.toLocaleString()} credits</span>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                    <span className="hidden sm:inline">Top up</span>
                    <span className="sm:hidden">+</span>
                  </Button>
                </div>

                {/* Notifications */}
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white relative">
                  <Bell className="w-4 h-4" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
                    1
                  </span>
                </Button>

                {/* User */}
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: 'w-8 h-8',
                    },
                  }}
                />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6">
            <div className="max-w-6xl mx-auto">
              {/* Page Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Billing & Payments</h1>
                <p className="text-gray-400">
                  Manage your credits, view transaction history, and handle billing settings.
                </p>
              </div>

              {/* Billing Content */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-[#2a2a2a] border-white/10">
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
                  <TabsTrigger
                    value="organization"
                    className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-400"
                    disabled={!organization || !isAdmin}
                  >
                    <Building className="w-4 h-4 mr-2" />
                    Organization
                    {!organization && <span className="ml-1 text-xs">(No Org)</span>}
                    {organization && !isAdmin && <span className="ml-1 text-xs">(Admin Only)</span>}
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
                        {currentBalance.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400">
                        credits available
                      </div>
                      {currentBalance < 100 && (
                        <div className="mt-2 flex items-center gap-2 text-yellow-400 text-xs">
                          <AlertTriangle className="w-3 h-3" />
                          Low balance warning
                        </div>
                      )}
                    </Card>

                    {/* Monthly Usage Card */}
                    <Card className="bg-[#2a2a2a] border-white/10 p-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">This Month</span>
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">
                        -450
                      </div>
                      <div className="text-xs text-gray-400">
                        credits used
                      </div>
                    </Card>

                    {/* Next Payment Card */}
                    <Card className="bg-[#2a2a2a] border-white/10 p-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Next Payment</span>
                        <CreditCard className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">
                        {formatCurrency(7.00)}
                      </div>
                      <div className="text-xs text-gray-400">
                        Jan 15, 2024
                      </div>
                    </Card>
                  </div>

                  {/* Quick Actions */}
                  <Card className="bg-[#2a2a2a] border-white/10 p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Buy Credits
                      </Button>
                      <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                        <Download className="w-4 h-4 mr-2" />
                        Download Invoice
                      </Button>
                      <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
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
                            <div className="text-lg font-bold text-green-400">$7.00</div>
                          </Button>
                          <Button
                            variant="outline"
                            className="border-white/20 text-white hover:bg-blue-600/20 hover:border-blue-500 p-4 h-auto flex flex-col items-center gap-1"
                            onClick={() => handleCreditTopup(1000)}
                            disabled={isLoading}
                          >
                            <div className="text-sm font-medium">1,000 credits</div>
                            <div className="text-lg font-bold text-green-400">$14.00</div>
                          </Button>
                          <Button
                            variant="outline"
                            className="border-white/20 text-white hover:bg-blue-600/20 hover:border-blue-500 p-4 h-auto flex flex-col items-center gap-1"
                            onClick={() => handleCreditTopup(2500)}
                            disabled={isLoading}
                          >
                            <div className="text-sm font-medium">2,500 credits</div>
                            <div className="text-lg font-bold text-green-400">$35.00</div>
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
                          <span className="text-gray-400">This month</span>
                          <span className="text-white font-medium">-450 credits</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Last month</span>
                          <span className="text-white font-medium">-320 credits</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Average daily</span>
                          <span className="text-white font-medium">-15 credits</span>
                        </div>

                        <div className="pt-4 border-t border-white/10">
                          <div className="text-sm text-gray-400">
                            Rate: 1 credit = $0.014
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
                      <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {mockCreditTransactions.map((transaction) => (
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
                  </Card>
                </TabsContent>

                {/* Organization Tab */}
                <TabsContent value="organization" className="mt-6">
                  {organization && isAdmin ? (
                    <BillingDashboard />
                  ) : (
                    <Card className="bg-[#2a2a2a] border-white/10 p-8">
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto">
                          <Building className="w-8 h-8 text-gray-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-2">
                            {!organization ? 'No Organization Selected' : 'Admin Access Required'}
                          </h3>
                          <p className="text-gray-400">
                            {!organization
                              ? 'Create or join an organization to manage billing settings.'
                              : 'Only organization administrators can view billing settings.'
                            }
                          </p>
                        </div>
                      </div>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default Billing;