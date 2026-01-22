import { useUser, UserButton, useAuth, useOrganization, OrganizationSwitcher, OrganizationProfile } from '@clerk/clerk-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { User } from '@/utils/supabase/database';
import {
  Settings,
  CreditCard,
  Copy,
  RefreshCw,
  Code,
  ChevronDown,
  Plus,
  HelpCircle,
  FileText,
  Mail,
  Zap,
  Users,
  MoreHorizontal,
  Home,
  DollarSign,
  Loader2,
  History as HistoryIcon,
  Minus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { setAuthPageMeta } from '@/utils/seo';
import {
  AddCreditsRequest,
  AddCreditsResponse,
  CREDIT_CONVERSION,
  QUICK_SELECT_AMOUNTS,
  CREDIT_LIMITS
} from '@/types/credits';
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

// Mock data for the dashboard
import { createStripeCustomerPortalSession } from '@/api/stripe';
import { TokenManagement } from '@/components/dashboard/TokenManagement';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/AnalyticsTable';
import { DateRangePicker } from '@/components/DateRangePicker';
import { getOrgAnalytics, getOrgUsersAnalytics } from '@/api/analytics';
import { OrgAnalytics, UserAnalytics } from '@/types/analytics';
import { ColumnDef } from '@tanstack/react-table';

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

const Dashboard = () => {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();
  const { organization, isLoaded: orgLoaded, membership } = useOrganization();
  const { toast } = useToast();
  
  const isAdmin = membership?.role === 'org:admin';
  
  // User data from Supabase
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [isDbUserLoading, setIsDbUserLoading] = useState(true);

  // Extension token state
  const [extensionToken, setExtensionToken] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [autoRenew, setAutoRenew] = useState(true);
  const [hasActiveLongLivedToken, setHasActiveLongLivedToken] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(false);

  // Credits state
  const [currentBalance, setCurrentBalance] = useState<number>(0); // Initialize with 0, will be updated from dbUser
  const [creditAmount, setCreditAmount] = useState<string>('');
  const [isAddingCredits, setIsAddingCredits] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  // Derive active pool from organization context
  const activePool = organization ? 'organization' : 'personal';
  const [orgCredits, setOrgCredits] = useState<{
    total_credits: number;
    used_credits: number;
    remaining_credits: number;
  } | null>(null);
  const [isLoadingOrgCredits, setIsLoadingOrgCredits] = useState(false);
  const [orgSubscription, setOrgSubscription] = useState<{
    plan_type: string;
    status: string;
    seats_total: number;
    seats_used: number;
  } | null>(null);
  const [isLoadingOrgSubscription, setIsLoadingOrgSubscription] = useState(false);
  const [creditHistory, setCreditHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Billing portal state
  const [isBillingPortalLoading, setIsBillingPortalLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'usage'>('dashboard');

  // Analytics state
  const [dateRange, setDateRange] = useState({ start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() });
  const [orgAnalytics, setOrgAnalytics] = useState<OrgAnalytics | null>(null);
  const [usersAnalytics, setUsersAnalytics] = useState<UserAnalytics[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Backend URL - adjust based on environment
  // const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  useEffect(() => {
    setAuthPageMeta('dashboard');
  }, []);

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (organization?.id && activePool === 'organization') {
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
  }, [organization?.id, activePool, dateRange]);

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
        return new Date(row.getValue("last_active")).toLocaleDateString()
      },
    },
  ];

  // Fetch user data from Supabase database using Clerk ID
  useEffect(() => {
    const fetchDbUser = async () => {
      if (userLoaded && user?.id) {
        setIsDbUserLoading(true);
        console.log('=== DASHBOARD DATA FETCH DEBUG ===');
        console.log('Clerk User ID:', user.id);
        console.log('Clerk User Email:', user.emailAddresses?.[0]?.emailAddress);
        console.log('Fetching user from Supabase database...');
        
        // Use API route to avoid RLS issues in browser
        console.log('🌐 Making API call to:', `/api/user/get?clerkId=${encodeURIComponent(user.id)}`);
        console.log('🌐 Current window location:', window.location.href);
        
        const response = await fetch(`/api/user/get?clerkId=${encodeURIComponent(user.id)}`);
        console.log('🌐 API Response status:', response.status);
        console.log('🌐 API Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          console.error('❌ API call failed with status:', response.status);
          const errorText = await response.text();
          console.error('❌ API error response:', errorText);
          throw new Error(`API call failed: ${response.status} - ${errorText}`);
        }
        
        const { data, error } = await response.json();
        
        console.log('Database query result:');
        console.log('- Data:', data);
        console.log('- Error:', error);
        
        if (error) {
          console.error('❌ Database fetch error:', error);
        } else if (data) {
          console.log('✅ Successfully fetched user data:');
          console.log('- Credits:', data.credits);
          console.log('- Plan Type:', data.plan_type);
          console.log('- Email:', data.email);
          console.log('- Clerk ID:', data.clerk_id);
          
          setDbUser(data);
          setCurrentBalance(data.credits);
        } else {
          console.log('⚠️ No user found in database for Clerk ID:', user.id);
          console.log('Attempting to initialize user in database...');
          
          // Try to initialize the user in Supabase via API
          const initResponse = await fetch('/api/user/initialize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              clerkUser: {
                id: user.id,
                emailAddresses: [{ emailAddress: user.emailAddresses?.[0]?.emailAddress || user.primaryEmailAddress?.emailAddress || '' }],
                firstName: user.firstName,
                lastName: user.lastName
              },
              planType: 'starter'
            }),
          });
          
          const { user: newUser, error: initError } = await initResponse.json();
          
          if (initError) {
            console.error('❌ Error initializing user:', initError);
          } else if (newUser) {
            console.log('✅ Successfully created user in database:');
            console.log('- Credits:', newUser.credits);
            console.log('- Plan Type:', newUser.plan_type);
            
            setDbUser(newUser);
            setCurrentBalance(newUser.credits);
          } else {
            console.log('❌ Failed to create user in database');
          }
        }
        
        console.log('=== END DASHBOARD DATA FETCH DEBUG ===');
        setIsDbUserLoading(false);
      } else if (userLoaded && !user?.id) {
        console.log('⚠️ Clerk user not loaded or no user ID available');
        setIsDbUserLoading(false);
      }
    };

    fetchDbUser();
  }, [userLoaded, user?.id, toast]);

  // Fetch organization credits if user is in an organization
  useEffect(() => {
    const fetchOrgCredits = async () => {
      if (organization?.id) {
        setIsLoadingOrgCredits(true);
        try {
          const token = await getToken();
          const { getOrgCredits } = await import('@/utils/organization/billing');
          const data = await getOrgCredits(organization.id, token);
          setOrgCredits(data);
        } catch (error) {
          console.error('Error fetching organization credits:', error);
        } finally {
          setIsLoadingOrgCredits(false);
        }
      } else {
        setOrgCredits(null);
      }
    };

    fetchOrgCredits();
  }, [organization?.id, getToken]);

  // Fetch organization subscription if user is in an organization
  useEffect(() => {
    const fetchOrgSubscription = async () => {
      if (organization?.id) {
        setIsLoadingOrgSubscription(true);
        try {
          const token = await getToken();
          const { getOrganizationSubscription } = await import('@/utils/organization/billing');
          const data = await getOrganizationSubscription(organization.id, token);
          setOrgSubscription(data);
        } catch (error) {
          console.error('Error fetching organization subscription:', error);
        } finally {
          setIsLoadingOrgSubscription(false);
        }
      } else {
        setOrgSubscription(null);
      }
    };

    fetchOrgSubscription();
  }, [organization?.id, getToken]);


  // Check for active long-lived token
  const checkActiveLongLivedToken = async () => {
    if (!user?.id) return;

    setIsCheckingToken(true);
    try {
      const clerkToken = await getToken(); // Session token for auth
      const response = await fetch('/api/extension-token/active', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${clerkToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHasActiveLongLivedToken(data.hasActive);
      }
    } catch (error) {
      console.error('Error checking active token:', error);
    } finally {
      setIsCheckingToken(false);
    }
  };

  useEffect(() => {
    checkActiveLongLivedToken();
  }, [user?.id]);

  // Fetch credit history based on active pool
  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.id) return;
      
      setIsLoadingHistory(true);
      try {
        const { creditOperations } = await import('@/utils/supabase/database');
        const result = await creditOperations.getCreditHistory(
          user.id,
          activePool === 'organization' ? organization?.id : undefined
        );
        
        if (result.data) {
          setCreditHistory(result.data);
        }
      } catch (error) {
        console.error('Error fetching credit history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [user?.id, activePool, organization?.id]);

  const generateToken = async () => {
    if (!user?.id) {
      toast({
        title: "Authentication Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      console.log('=== DASHBOARD TOKEN GENERATION DEBUG ===');
      console.log(`Generating long-lived token for VSCode extension...`);
      console.log('Clerk User ID:', user.id);
      
      // Long-lived: Call backend endpoint
      const clerkToken = await getToken(); // Session token for auth
      const response = await fetch('/api/extension-token/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${clerkToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId: activePool === 'organization' ? organization?.id : null,
          deviceName: 'VSCode Extension'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate long-lived token');
      }

      const data = await response.json();
      if (!data.access_token) {
        throw new Error('No access token in response');
      }

      const backendToken = data.access_token;
      console.log('✅ Generated long-lived backend token');
      setHasActiveLongLivedToken(true);
      
      setExtensionToken(backendToken);
      
      const expiryText = '4 months';
      
      toast({
        title: "Token Generated",
        description: `Long-lived token generated successfully. Expires in ${expiryText}. Copy and paste this into your VSCode extension settings.`,
      });
      
    } catch (error) {
      console.error('❌ Token generation error:', error);
      console.log('=== END DASHBOARD TOKEN GENERATION DEBUG ===');
      
      // Fallback mock for dev
      if (import.meta.env.DEV) {
        const mockToken = `mock_long_token_${user.id}_${Date.now()}`;
        setExtensionToken(mockToken);
        console.log('🔧 Using mock token for development:', mockToken);
        
        toast({
          title: "Development Mode",
          description: `Using mock long-lived token for development`,
        });
      } else {
        toast({
          title: "Token Generation Failed",
          description: error instanceof Error ? error.message : "Failed to generate extension token",
          variant: "destructive",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToken = async () => {
    if (!extensionToken) return;
    
    try {
      await navigator.clipboard.writeText(extensionToken);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy token:', error);
    }
  };

  const refreshToken = () => {
    setExtensionToken('');
    generateToken();
  };

  const revokeLongLivedToken = async () => {
    if (!user?.id || !hasActiveLongLivedToken) return;

    if (!confirm('This will revoke your active long-lived extension token. You will need to generate a new one to continue using the VSCode extension. Continue?')) {
      return;
    }

    try {
      const clerkToken = await getToken();
      const response = await fetch('/api/extension-token/revoke', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${clerkToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setHasActiveLongLivedToken(false);
        toast({
          title: "Token Revoked",
          description: "Your long-lived extension token has been revoked.",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke token');
      }
    } catch (error) {
      console.error('Error revoking token:', error);
      toast({
        title: "Revocation Failed",
        description: error instanceof Error ? error.message : "Failed to revoke token",
        variant: "destructive",
      });
    }
  };

  // Credit validation function
  const validateCreditAmount = (creditsStr: string): string => {
    const numCredits = parseInt(creditsStr);
    
    if (!creditsStr || creditsStr.trim() === '') {
      return 'Number of credits is required';
    }
    
    if (isNaN(numCredits)) {
      return 'Please enter a valid number';
    }
    
    if (numCredits < CREDIT_LIMITS.MIN_PURCHASE_CREDITS) {
      return `Minimum purchase is ${CREDIT_LIMITS.MIN_PURCHASE_CREDITS.toLocaleString()} credits`;
    }
    
    if (numCredits > CREDIT_LIMITS.MAX_PURCHASE_CREDITS) {
      return `Maximum purchase is ${CREDIT_LIMITS.MAX_PURCHASE_CREDITS.toLocaleString()} credits`;
    }
    
    // Check if it's a whole number
    if (creditsStr.includes('.')) {
      return 'Credits must be a whole number';
    }
    
    return '';
  };

  // Handle input change with validation
  const handleAmountChange = (value: string) => {
    setCreditAmount(value);
    const error = validateCreditAmount(value);
    setValidationError(error);
  };

  // Handle quick select buttons
  const handleQuickSelect = (credits: number) => {
    const creditsStr = credits.toString();
    setCreditAmount(creditsStr);
    setValidationError('');
  };

  // Add credits function
  const addCredits = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    const error = validateCreditAmount(creditAmount);
    if (error) {
      setValidationError(error);
      return;
    }

    setIsAddingCredits(true);

    try {
      const creditsToAdd = parseInt(creditAmount);
      const token = await getToken();

      if (activePool === 'organization' && organization?.id) {
        // Organization top-up
        const { createOrgCreditTopup } = await import('@/utils/organization/billing');
        const result = await createOrgCreditTopup(organization.id, creditsToAdd, token);
        
        if (result.success && result.checkout_url) {
          window.location.href = result.checkout_url;
        } else {
          throw new Error(result.error || 'Failed to create top-up session');
        }
      } else {
        // Individual purchase
        const amount = CREDIT_CONVERSION.creditsToEuros(creditsToAdd);
        const response = await fetch('/api/billing/credit-purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clerkUserId: user.id,
            credits: creditsToAdd,
            amount: amount,
            currency: 'EUR',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to create checkout session');
        }

        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL received');
        }
      }
    } catch (error) {
      console.error('Error adding credits:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process credit addition",
        variant: "destructive",
      });
    } finally {
      setIsAddingCredits(false);
    }
  };

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

      if (activePool === 'organization' && organization?.id) {
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
            // Handle development mock case
            console.log('🔧 Development mode: Mock billing portal session');
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
                    afterCreateOrganizationUrl="/dashboard"
                    afterLeaveOrganizationUrl="/dashboard"
                    afterSelectOrganizationUrl="/dashboard"
                    hidePersonal={false}
                  />
                </div>
              )}
            </div>

            {/* Navigation Menu */}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={currentView === 'dashboard'}
                  onClick={() => setCurrentView('dashboard')}
                  className={currentView === 'dashboard' ? "bg-blue-600/20 text-white" : "text-white/70 hover:text-white hover:bg-white/10"}
                >
                  <Home className="w-4 h-4" />
                  <span>Dashboard</span>
                  <SidebarMenuBadge></SidebarMenuBadge>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {activePool === 'organization' && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={currentView === 'usage'}
                    onClick={() => setCurrentView('usage')}
                    className={currentView === 'usage' ? "bg-blue-600/20 text-white" : "text-white/70 hover:text-white hover:bg-white/10"}
                  >
                    <Zap className="w-4 h-4" />
                    <span>Usage</span>
                    <SidebarMenuBadge></SidebarMenuBadge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              
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
                  <span className="text-white">Dashboard</span>
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
            {currentView === 'dashboard' ? (
              <>
{/* VSCode Extension Integration */}
<Card className="bg-[#2a2a2a] border-white/10 p-6 mb-8 flex flex-col min-h-[200px]">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-lg font-semibold text-white">Authentication Token</h3>
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="border-white/20 text-white hover:bg-white/10"
        onClick={refreshToken}
        disabled={isGenerating}
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  </div>
  
  <div className="space-y-4 flex-1">
    <div className="text-sm text-gray-400 mb-3">
      Generate an authentication token to connect your VSCode extension to your account.
    </div>

    {/* Warning for Long-Lived */}
    <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-md text-orange-300 text-xs">
      Tokens grant extended access to Softcodes. Store securely and revoke if compromised.
    </div>
    
    {!extensionToken ? (
      <Button
        onClick={generateToken}
        disabled={isGenerating}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            Generating Authentication Token...
          </>
        ) : (
          <>
            <Code className="w-4 h-4 mr-2" />
            Generate Authentication Token
          </>
        )}
      </Button>
    ) : (
      <div className="space-y-3">
        <div className="text-sm font-medium text-white">
          Your Authentication Token:
        </div>
        <div className="flex gap-2">
          <Input
            value={extensionToken}
            readOnly
            className="bg-[#1a1a1a] border-white/10 text-white font-mono text-sm flex-1"
          />
          <Button
            onClick={copyToken}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10 shrink-0"
          >
            {copySuccess ? (
              <>
                <span className="text-green-400">✓</span>
                <span className="ml-1 hidden sm:inline">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span className="ml-1 hidden sm:inline">Copy</span>
              </>
            )}
          </Button>
        </div>
        <div className="text-xs text-gray-500">
          Long-lived backend JWT token. Expires in 4 months. Copy now - it won't be shown again. Use in VSCode extension settings.
        </div>
        <Button
          variant="destructive"
          onClick={revokeLongLivedToken}
          disabled={isCheckingToken}
          className="w-full"
        >
          {isCheckingToken ? 'Checking...' : 'Revoke Active Long-Lived Token'}
        </Button>
      </div>
    )}
  </div>
</Card>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

              {/* Credits Card */}
              <Card className="bg-[#2a2a2a] border-white/10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-400">Available Credits</span>
                    <span className="text-xs text-gray-500 capitalize">{activePool} Pool</span>
                  </div>
                </div>
                {isDbUserLoading || (activePool === 'organization' && isLoadingOrgCredits) ? (
                  <div className="h-8 bg-gray-600 rounded w-32 animate-pulse mb-1"></div>
                ) : (
                  <div className="text-2xl font-bold text-white mb-1">
                    {activePool === 'personal'
                      ? (dbUser ? currentBalance.toLocaleString() : '0')
                      : (orgCredits ? orgCredits.remaining_credits.toLocaleString() : '0')
                    }
                  </div>
                )}
              </Card>

              {/* Current Plan Card */}
              <Card className="bg-[#2a2a2a] border-white/10 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Current Plan</span>
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </div>
                {activePool === 'organization' ? (
                  isLoadingOrgSubscription ? (
                    <div className="h-8 bg-gray-600 rounded w-24 animate-pulse mb-1"></div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-white">
                        {orgSubscription?.plan_type ? orgSubscription.plan_type.charAt(0).toUpperCase() + orgSubscription.plan_type.slice(1) : 'No Subscription'}
                      </div>
                      {orgSubscription?.status && (
                        <div className="text-xs text-gray-400 capitalize">
                          Status: {orgSubscription.status}
                        </div>
                      )}
                      {orgSubscription?.seats_total && (
                        <div className="text-xs text-gray-400">
                          {orgSubscription.seats_used || 0} / {orgSubscription.seats_total} seats
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  isDbUserLoading ? (
                    <div className="h-8 bg-gray-600 rounded w-24 animate-pulse mb-1"></div>
                  ) : (
                    <div className="text-2xl font-bold text-white mb-1">
                      {dbUser?.plan_type ? dbUser.plan_type.charAt(0).toUpperCase() + dbUser.plan_type.slice(1) : 'Loading...'}
                    </div>
                  )
                )}
              </Card>
            </div>


            {/* Add Credits Section */}
            {/* Add Credits Section */}
            <Card className="bg-[#2a2a2a] border-white/10 p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-semibold text-white">
                    Add {activePool === 'organization' ? 'Team' : 'Personal'} Credits
                  </h3>
                </div>
                {activePool === 'organization' && !isAdmin && (
                  <Badge variant="outline" className="text-orange-400 border-orange-400/20">
                    Admin Only
                  </Badge>
                )}
              </div>
              
              {activePool === 'organization' && !isAdmin ? (
                <div className="p-4 bg-orange-500/5 border border-orange-500/10 rounded-lg text-center">
                  <p className="text-sm text-gray-400">
                    Only organization administrators can top up the team credit pool.
                  </p>
                </div>
              ) : (
              <div className="space-y-4">
                {/* Credits Input */}
                <div>
                  <Label htmlFor="credit-amount" className="text-sm text-gray-400 mb-2 block">
                    Credits to Add
                  </Label>
                  <div className="relative">
                    <Input
                      id="credit-amount"
                      type="number"
                      min={CREDIT_LIMITS.MIN_PURCHASE_CREDITS}
                      max={CREDIT_LIMITS.MAX_PURCHASE_CREDITS}
                      step="1"
                      value={creditAmount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      placeholder="500"
                      className={`bg-[#1a1a1a] border-white/10 text-white placeholder-gray-500 ${
                        validationError ? 'border-red-500' : ''
                      }`}
                      disabled={isAddingCredits}
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                      credits
                    </span>
                  </div>
                  {validationError && (
                    <p className="text-red-400 text-xs mt-1">{validationError}</p>
                  )}
                  {creditAmount && !validationError && (
                    <p className="text-green-400 text-xs mt-1">
                      Cost: €{CREDIT_CONVERSION.creditsToEuros(parseInt(creditAmount) || 0).toFixed(2)}
                    </p>
                  )}
                </div>

                {/* Quick Select Buttons */}
                <div>
                  <Label className="text-sm text-gray-400 mb-2 block">Quick Select</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {QUICK_SELECT_AMOUNTS.map((quickAmount) => (
                      <Button
                        key={quickAmount.credits}
                        variant="outline"
                        onClick={() => handleQuickSelect(quickAmount.credits)}
                        className={`border-white/20 text-white hover:bg-blue-600/20 hover:border-blue-500 p-4 h-auto flex flex-col items-center gap-1 relative ${
                          quickAmount.popular ? 'border-blue-500/50 bg-blue-600/10' : ''
                        }`}
                        disabled={isAddingCredits}
                      >
                        {quickAmount.popular && (
                          <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                            Popular
                          </div>
                        )}
                        <div className="text-sm font-medium">{quickAmount.credits.toLocaleString()} credits</div>
                        <div className="text-lg font-bold text-green-400">€{quickAmount.cost.toFixed(2)}</div>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Add Credits Button */}
                <Button
                  onClick={addCredits}
                  disabled={isAddingCredits || !creditAmount || !!validationError}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAddingCredits ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Credits
                    </>
                  )}
                </Button>

              </div>
              )}
            </Card>

            {/* Transaction History Section */}
            <Card className="bg-[#2a2a2a] border-white/10 p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <HistoryIcon className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-semibold text-white">
                    {activePool === 'organization' ? 'Team' : 'Personal'} Usage History
                  </h3>
                </div>
              </div>

              <div className="space-y-3">
                {isLoadingHistory ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-600/20 rounded-lg animate-pulse"></div>
                  ))
                ) : creditHistory.length > 0 ? (
                  creditHistory.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 bg-[#1a1a1a] rounded-lg border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          transaction.credits_amount > 0 ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                        }`}>
                          {transaction.credits_amount > 0 ? (
                            <Plus className="w-4 h-4" />
                          ) : (
                            <Minus className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="text-white font-medium text-sm">{transaction.description}</div>
                          <div className="text-gray-500 text-xs">
                            {new Date(transaction.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-sm ${
                          transaction.credits_amount > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {transaction.credits_amount > 0 ? '+' : ''}{transaction.credits_amount}
                        </div>
                        {transaction.metadata?.pool === 'organization' && (
                          <div className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold">
                            Team Pool
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No transactions found for this pool.</p>
                  </div>
                )}
              </div>
            </Card>
            </>
            ) : (
              // Usage View
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
            )}

          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default Dashboard;