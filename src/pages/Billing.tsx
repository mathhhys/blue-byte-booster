import { useUser, UserButton, useAuth, useOrganization, OrganizationSwitcher } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Bell,
  Users,
  Home,
  Code,
  CreditCard,
  FileText,
  Mail,
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
import { PersonalBilling } from '@/components/billing/PersonalBilling';
import { createStripeCustomerPortalSession } from '@/api/stripe';
import { createOrganizationBillingPortal } from '@/utils/organization/billing';

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
    organizationSwitcherTrigger: "bg-transparent border-white/10 text-white hover:bg-white/10 p-2 rounded-md",
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

const Billing = () => {
  const { user } = useUser();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [isBillingPortalLoading, setIsBillingPortalLoading] = useState(false);

  useEffect(() => {
    setAuthPageMeta('billing');
  }, []);

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
      let result;
      
      if (organization?.id) {
        const token = await getToken();
        result = await createOrganizationBillingPortal(organization.id, token);
      } else {
        result = await createStripeCustomerPortalSession(user.id);
      }

      if (result.success) {
        if (result.url) {
          window.location.href = result.url;
        } else if ('mock' in result && result.mock && import.meta.env.DEV) {
          toast({
            title: "Development Mode",
            description: "Billing portal would redirect in production. Using mock implementation.",
          });
        } else {
          toast({
            title: "Billing Portal Error",
            description: "Failed to access billing portal. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Billing Portal Error",
          description: ('error' in result ? result.error : null) || "Failed to access billing portal. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Error accessing billing portal:', error);
      toast({
        title: "Billing Portal Error",
        description: "An unexpected error occurred. Please try again later.",
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
                  className="bg-blue-600/20 text-white"
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
                <h1 className="text-3xl font-bold text-white mb-2">
                  {organization ? `${organization.name} Billing` : 'Personal Billing'}
                </h1>
                <p className="text-gray-400">
                  {organization 
                    ? 'Manage your organization subscription, seats, and billing settings.'
                    : 'Manage your personal credits, view transaction history, and handle billing settings.'
                  }
                </p>
              </div>

              {/* Context-Aware Billing Content */}
              {organization ? (
                <BillingDashboard />
              ) : (
                <PersonalBilling />
              )}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default Billing;