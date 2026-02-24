import { useUser, UserButton, useAuth, useOrganization, OrganizationSwitcher, OrganizationProfile } from '@clerk/clerk-react';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/AnalyticsTable';
import { DateRangePicker } from '@/components/DateRangePicker';
import { getOrgAnalytics, getOrgUsersAnalytics } from '@/api/analytics';
import { OrgAnalytics, UserAnalytics } from '@/types/analytics';
import { ColumnDef } from '@tanstack/react-table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Settings,
  Users,
  Home,
  Code,
  CreditCard,
  FileText,
  Mail,
  Building,
  DollarSign,
  RefreshCw,
  Loader2,
  Zap,
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
import { createStripeCustomerPortalSession } from '@/api/stripe';

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

const Organizations = () => {
  const { user } = useUser();
  const { organization, isLoaded: orgLoaded, membership } = useOrganization();
  const { toast } = useToast();
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState('settings');
  const [isBillingPortalLoading, setIsBillingPortalLoading] = useState(false);

  // Analytics state
  const [dateRange, setDateRange] = useState({ start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() });
  const [orgAnalytics, setOrgAnalytics] = useState<OrgAnalytics | null>(null);
  const [usersAnalytics, setUsersAnalytics] = useState<UserAnalytics[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  const userColumns: ColumnDef<UserAnalytics>[] = [
    {
      accessorKey: "user_id",
      header: "User ID",
    },
    {
      accessorKey: "total_requests",
      header: "Requests",
    },
    {
      accessorKey: "total_credits",
      header: "Credits Spent",
    },
    {
      accessorKey: "total_input_tokens",
      header: "Input Tokens",
    },
    {
      accessorKey: "total_output_tokens",
      header: "Output Tokens",
    },
    {
      accessorKey: "last_active",
      header: "Last Active",
      cell: ({ row }) => {
        return new Date(row.getValue("last_active") as string).toLocaleDateString()
      },
    },
  ];

  const isAdmin = membership?.role === 'org:admin';

  useEffect(() => {
    setAuthPageMeta('organizations');
  }, []);

  // Set default tab based on admin status
  useEffect(() => {
    if (organization && isAdmin) {
      setActiveTab('settings');
    }
  }, [organization, isAdmin]);

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (organization?.id) {
        setIsLoadingAnalytics(true);
        try {
          const [orgData, usersData] = await Promise.all([
            getOrgAnalytics(organization.id, dateRange.start, dateRange.end),
            getOrgUsersAnalytics(organization.id, dateRange.start, dateRange.end)
          ]);
          setOrgAnalytics(orgData);
          setUsersAnalytics(usersData);
        } catch (error) {
          console.error('Error fetching analytics:', error);
        } finally {
          setIsLoadingAnalytics(false);
        }
      }
    };

    fetchAnalytics();
  }, [organization?.id, dateRange]);

  // Billing portal redirect function
  const handleBillingPortalRedirect = async () => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to access billing information",
        variant: "destructive",
      });
      return;
    }

    setIsBillingPortalLoading(true);

    try {
      const token = await getToken();

      if (organization?.id) {
        console.log('🔧 Initiating billing portal redirect for organization:', organization.id);
        const { createOrganizationBillingPortal } = await import('@/utils/organization/billing');
        const result = await createOrganizationBillingPortal(organization.id, token);

        if (result.success && result.url) {
          console.log('✅ Organization billing portal session created, redirecting to:', result.url);
          window.location.href = result.url;
        } else {
          throw new Error(result.error || 'Failed to create organization billing portal session');
        }
      } else {
        console.log('🔧 Initiating billing portal redirect for user:', user.id);
        const result = await createStripeCustomerPortalSession(user.id);

        if (result.success) {
          if (result.url) {
            console.log('✅ Billing portal session created, redirecting to:', result.url);
            window.location.href = result.url;
          } else if ('mock' in result && result.mock && import.meta.env.DEV) {
            toast({
              title: "Development Mode",
              description: "Billing portal would redirect in production. Using mock implementation.",
            });
          } else {
            console.error('❌ Failed to create billing portal session: No URL provided');
            toast({
              title: "Billing Portal Error",
              description: "Failed to access billing portal. Please try again.",
              variant: "destructive",
            });
          }
        } else {
          console.error('❌ Failed to create billing portal session:', 'error' in result ? result.error : 'Unknown error');
          toast({
            title: "Billing Portal Error",
            description: ('error' in result ? result.error : null) || "Failed to access billing portal. Please try again.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('❌ Error accessing billing portal:', error);
      toast({
        title: "Billing Portal Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsBillingPortalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <SidebarProvider>
        {/* Sidebar */}
        <Sidebar className="border-r border-[#2a2a2a] bg-[#161616]">
          <SidebarHeader className="h-32 flex items-center justify-center p-0 border-b border-[#2a2a2a]">
            <Link to="/" className="mt-0 mb-0 relative w-32 h-32 overflow-hidden" style={{ display: "inline-block" }}>
              <img
                src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-logo/softcodes%20logo%20navbar%20desktop%20not%20scrolled.svg"
                alt="Softcodes Logo"
                className="w-32 h-32 object-contain"
                loading="eager"
              />
            </Link>
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
                    afterCreateOrganizationUrl="/organizations"
                    afterLeaveOrganizationUrl="/organizations"
                    afterSelectOrganizationUrl="/organizations"
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
                  className="text-white/70 hover:text-white hover:bg-white/10"
                  onClick={handleBillingPortalRedirect}
                  disabled={isBillingPortalLoading}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {isBillingPortalLoading ? 'Loading...' : 'Billing'}
                  </span>
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
                  <SidebarMenuButton asChild className="text-white/70 hover:text-white hover:bg-white/10">
                    <a href="https://docs.softcodes.ai/InstallingSoftcodes" target="_blank" rel="noopener noreferrer">
                      <FileText className="w-4 h-4" />
                      <span>Get Started</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
            
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="text-white/70 hover:text-white hover:bg-white/10">
                    <a href="https://docs.softcodes.ai/InstallingSoftcodes" target="_blank" rel="noopener noreferrer">
                      <FileText className="w-4 h-4" />
                      <span>Docs</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
            
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="text-white/70 hover:text-white hover:bg-white/10">
                    <a href="mailto:mathys@softcodes.io">
                      <Mail className="w-4 h-4" />
                      <span>Contact Support</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
          </SidebarContent>
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
                  <span className="text-white">Organizations</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">



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
                <h1 className="text-3xl font-bold text-white mb-2">
                  {organization ? `${organization.name}` : 'Organizations'}
                </h1>
                <p className="text-gray-400">
                  {organization 
                    ? 'Manage your organization settings, members, and billing.'
                    : 'Create or join an organization to collaborate with your team.'
                  }
                </p>
              </div>

              {/* Organization Content */}
              <div className="space-y-6">
                {!orgLoaded ? (
                  <Card className="bg-[#2a2a2a] border-white/10 p-8">
                    <div className="space-y-4">
                      <div className="h-8 bg-gray-600 rounded animate-pulse w-1/3"></div>
                      <div className="h-4 bg-gray-600 rounded animate-pulse w-3/4"></div>
                      <div className="h-4 bg-gray-600 rounded animate-pulse w-1/2"></div>
                      <div className="h-4 bg-gray-600 rounded animate-pulse w-2/3"></div>
                    </div>
                  </Card>
                ) : organization ? (
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-[#2a2a2a] border-white/10">
                      <TabsTrigger
                        value="settings"
                        className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-400"
                      >
                        <Building className="w-4 h-4 mr-2" />
                        Organization Settings
                      </TabsTrigger>
                      <TabsTrigger
                        value="billing"
                        className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-400"
                        disabled={!isAdmin}
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Billing
                        {!isAdmin && <span className="ml-1 text-xs">(Admin Only)</span>}
                      </TabsTrigger>
                      <TabsTrigger
                        value="usage"
                        className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-400"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Usage
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="settings" className="mt-6">
                      <Card className="bg-[#2a2a2a] border-white/10 p-6">
                        <div className="clerk-organization-profile">
                          <OrganizationProfile
                            appearance={{
                              ...clerkAppearance,
                              layout: {
                                unsafe_disableDevelopmentModeWarnings: true
                              }
                            }}
                            routing="hash"
                          />
                        </div>
                      </Card>
                    </TabsContent>

                    <TabsContent value="billing" className="mt-6">
                      <BillingDashboard />
                    </TabsContent>

                    <TabsContent value="usage" className="mt-6">
                      <div className="mb-8">
                        <div className="flex items-center justify-between mb-6">
                          <h2 className="text-2xl font-bold text-white">Analytics</h2>
                          <DateRangePicker onChange={setDateRange} />
                        </div>

                        <Tabs defaultValue="org" className="space-y-4">
                          <TabsList className="bg-[#1a1a1a] border border-white/10">
                            <TabsTrigger value="org" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-400">Organization Overview</TabsTrigger>
                            <TabsTrigger value="per-seat" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-400">Per-Seat Usage</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="org" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <Card className="bg-[#2a2a2a] border-white/10">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-medium text-gray-400">Total Requests</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-2xl font-bold text-white">
                                    {isLoadingAnalytics ? (
                                      <div className="h-8 w-24 bg-gray-600/20 rounded animate-pulse" />
                                    ) : (
                                      orgAnalytics?.total_requests.toLocaleString() || 0
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                              <Card className="bg-[#2a2a2a] border-white/10">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-medium text-gray-400">Credits Spent</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-2xl font-bold text-white">
                                    {isLoadingAnalytics ? (
                                      <div className="h-8 w-24 bg-gray-600/20 rounded animate-pulse" />
                                    ) : (
                                      orgAnalytics?.total_credits.toLocaleString() || 0
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                              <Card className="bg-[#2a2a2a] border-white/10">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-medium text-gray-400">Input Tokens</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-2xl font-bold text-white">
                                    {isLoadingAnalytics ? (
                                      <div className="h-8 w-24 bg-gray-600/20 rounded animate-pulse" />
                                    ) : (
                                      orgAnalytics?.total_input_tokens.toLocaleString() || 0
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                              <Card className="bg-[#2a2a2a] border-white/10">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-medium text-gray-400">Output Tokens</CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <div className="text-2xl font-bold text-white">
                                    {isLoadingAnalytics ? (
                                      <div className="h-8 w-24 bg-gray-600/20 rounded animate-pulse" />
                                    ) : (
                                      orgAnalytics?.total_output_tokens.toLocaleString() || 0
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>

                            {/* Top Models */}
                            <Card className="bg-[#2a2a2a] border-white/10">
                              <CardHeader>
                                <CardTitle className="text-lg font-medium text-white">Top Models</CardTitle>
                              </CardHeader>
                              <CardContent>
                                {isLoadingAnalytics ? (
                                  <div className="space-y-2">
                                    {[1, 2, 3].map((i) => (
                                      <div key={i} className="h-12 bg-gray-600/20 rounded animate-pulse" />
                                    ))}
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    {orgAnalytics?.top_models?.map((model) => (
                                      <div key={model.model_id} className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg border border-white/5">
                                        <div>
                                          <div className="font-medium text-white">{model.model_id}</div>
                                          <div className="text-xs text-gray-500">{model.requests} requests</div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-bold text-white">€{model.cost.toFixed(4)}</div>
                                        </div>
                                      </div>
                                    ))}
                                    {(!orgAnalytics?.top_models || orgAnalytics.top_models.length === 0) && (
                                      <div className="text-center text-gray-500 py-4">No usage data available</div>
                                    )}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </TabsContent>

                          <TabsContent value="per-seat">
                            <Card className="bg-[#2a2a2a] border-white/10">
                              <CardHeader>
                                <CardTitle className="text-lg font-medium text-white">Per-Seat Usage</CardTitle>
                              </CardHeader>
                              <CardContent>
                                {isLoadingAnalytics ? (
                                  <div className="space-y-2">
                                    {[1, 2, 3].map((i) => (
                                      <div key={i} className="h-12 bg-gray-600/20 rounded animate-pulse" />
                                    ))}
                                  </div>
                                ) : (
                                  <DataTable columns={userColumns} data={usersAnalytics} />
                                )}
                              </CardContent>
                            </Card>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </TabsContent>

                  </Tabs>
                ) : (
                  <Card className="bg-[#2a2a2a] border-white/10 p-8">
                    <div className="text-center space-y-6">
                      <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto">
                        <Users className="w-8 h-8 text-gray-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white mb-2">No organization selected</h3>
                        <p className="text-gray-400 mb-6">
                          Create or join an organization to collaborate with your team and manage projects together.
                        </p>
                      </div>
                      <div className="bg-[#1a1a1a] rounded-lg p-6 text-left">
                        <h4 className="text-white font-medium mb-3">Getting started with organizations:</h4>
                        <ul className="text-gray-400 space-y-2">
                          <li className="flex items-start gap-2">
                            <span className="text-blue-400 mt-1">•</span>
                            <span>Use the organization switcher above to create a new organization</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-400 mt-1">•</span>
                            <span>Join an existing organization with an invitation link</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-400 mt-1">•</span>
                            <span>Switch between personal and organization accounts</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-400 mt-1">•</span>
                            <span>Manage members, settings, and billing for your organization</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default Organizations;