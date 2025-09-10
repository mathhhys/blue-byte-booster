import { useUser, UserButton, useAuth } from '@clerk/clerk-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  BarChart3, 
  Settings, 
  CreditCard, 
  Activity, 
  Copy, 
  RefreshCw, 
  Code,
  Search,
  Bell,
  ChevronDown,
  Plus,
  HelpCircle,
  FileText,
  Mail,
  Zap,
  Users,
  MoreHorizontal,
  Home,
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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

// Mock data for the dashboard
import { createStripeCustomerPortalSession } from '@/api/stripe';

const mockUsageData = [
  { date: '2024-01-01', credits: 1200 },
  { date: '2024-01-05', credits: 1800 },
  { date: '2024-01-10', credits: 1400 },
  { date: '2024-01-15', credits: 2200 },
  { date: '2024-01-20', credits: 1900 },
  { date: '2024-01-25', credits: 2400 },
  { date: '2024-01-30', credits: 2100 },
];

const mockRecentActivity = [
  {
    type: 'purchase',
    description: 'Credit purchase - 5000 credits',
    date: '2024-01-15',
    amount: '+5000 credits',
    positive: true
  },
  {
    type: 'usage',
    description: 'Code generation usage',
    date: '2024-01-14',
    amount: '-150 credits',
    positive: false
  }
];

const mockPaymentMethods = [
  {
    type: 'visa',
    last4: '4242',
    primary: true
  },
  {
    type: 'mastercard',
    last4: '8888',
    primary: false
  }
];

const Dashboard = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [extensionToken, setExtensionToken] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [autoRenew, setAutoRenew] = useState(true);

  useEffect(() => {
    setAuthPageMeta('dashboard');
  }, []);

  const generateToken = async () => {
    if (!user?.id) {
      alert('User not authenticated');
      return;
    }

    setIsGenerating(true);
    try {
      // Generate a Clerk session token
      const clerkToken = await getToken();
      
      if (clerkToken) {
        setExtensionToken(clerkToken);
        console.log('Generated Clerk token for VSCode extension');
      } else {
        // Fallback to a mock token for development
        const mockToken = `clerk_mock_token_${user.id}_${Date.now()}`;
        setExtensionToken(mockToken);
        console.log('Using mock Clerk token for development:', mockToken);
      }
    } catch (error) {
      console.error('Clerk token generation error:', error);
      // Fallback to a mock token for development
      const mockToken = `clerk_mock_token_${user.id}_${Date.now()}`;
      setExtensionToken(mockToken);
      console.log('Using mock Clerk token due to error:', mockToken);
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
              <span className="font-semibold text-white">Copilot Pro</span>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-4">
            {/* Personal Workspace */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 bg-blue-600 rounded-sm flex items-center justify-center">
                  <span className="text-xs font-bold text-white">P</span>
                </div>
                <span className="text-sm text-white/70">Personal Workspace</span>
                <ChevronDown className="w-4 h-4 text-white/70 ml-auto" />
              </div>
            </div>

            {/* Navigation Menu */}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive className="bg-blue-600/20 text-white">
                  <Home className="w-4 h-4" />
                  <span>Dashboard</span>
                  <SidebarMenuBadge></SidebarMenuBadge>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="text-white/70 hover:text-white hover:bg-white/10"
                  onClick={async () => {
                    if (user?.id) {
                      try {
                        console.log('=== BILLING PORTAL DEBUG START ===');
                        console.log('User ID:', user.id);
                        console.log('API Base URL from env:', import.meta.env.VITE_API_URL);
                        console.log('Full API endpoint URL:', `${import.meta.env.VITE_API_URL || ''}/api/stripe/create-customer-portal-session`);
                        
                        console.log('Creating billing portal session for user:', user.id);
                        const result = await createStripeCustomerPortalSession(user.id);
                        console.log('Billing portal result:', result);
                        
                        if (result.success && result.url) {
                          console.log('Success! Redirecting to:', result.url);
                          window.location.href = result.url;
                        } else if (result.success && 'mock' in result && result.mock) {
                          console.log('Mock billing portal in development mode');
                          console.log('=== BILLING PORTAL DEBUG END ===');
                          alert('Development Mode: Billing portal would open here. In production, this will redirect to Stripe Customer Portal.');
                        } else {
                          console.error('Billing portal failed with error:', 'error' in result ? result.error : 'Unknown error');
                          console.log('=== BILLING PORTAL DEBUG END ===');
                          alert(`Failed to open billing portal: ${'error' in result ? result.error : 'Unknown error'}`);
                        }
                      } catch (error) {
                        console.error('Exception in billing portal creation:', error);
                        console.log('Error details:', {
                          name: error instanceof Error ? error.name : 'Unknown',
                          message: error instanceof Error ? error.message : 'Unknown error',
                          stack: error instanceof Error ? error.stack : 'No stack trace'
                        });
                        console.log('=== BILLING PORTAL DEBUG END ===');
                        alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                      }
                    } else {
                      alert('User not logged in.');
                    }
                  }}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Billing</span>
                  <SidebarMenuBadge></SidebarMenuBadge>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton className="text-white/70 hover:text-white hover:bg-white/10">
                  <Users className="w-4 h-4" />
                  <span>Organizations</span>
                  <SidebarMenuBadge></SidebarMenuBadge>
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
                  <span>&gt;</span>
                  <span className="text-white">Dashboard</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative hidden md:block">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search or type a command..."
                    className="pl-10 w-80 bg-[#2a2a2a] border-white/10 text-white placeholder-gray-400"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                    F
                  </div>
                </div>

                {/* Credits */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 hidden sm:inline">1250 credits</span>
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
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Balance Card */}
              <Card className="bg-[#2a2a2a] border-white/10 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Balance</span>
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">$2549,5</div>
                <div className="text-xs text-gray-500">USD</div>
              </Card>

              {/* Credits Card */}
              <Card className="bg-[#2a2a2a] border-white/10 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Credits</span>
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">15 420</div>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white mt-2">
                  Top Up
                </Button>
              </Card>

              {/* Current Plan Card */}
              <Card className="bg-[#2a2a2a] border-white/10 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Current Plan</span>
                  <MoreHorizontal className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-white mb-1">Pro</div>
                <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10 mt-2">
                  Upgrade
                </Button>
              </Card>
            </div>

            {/* Usage & Credits Chart */}
            <Card className="bg-[#2a2a2a] border-white/10 p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Usage & Credits</h3>
                <Button size="sm" variant="outline" className="border-white/20 text-gray-300 hover:bg-white/10">
                  30d
                </Button>
              </div>
              <div className="h-64">
                <ChartContainer
                  config={{
                    credits: {
                      label: "Credits Used",
                      color: "hsl(214, 100%, 50%)",
                    },
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mockUsageData}>
                      <defs>
                        <linearGradient id="colorCredits" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(214, 100%, 50%)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(214, 100%, 50%)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#666' }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#666' }}
                      />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                      />
                      <Area
                        type="monotone"
                        dataKey="credits"
                        stroke="hsl(214, 100%, 50%)"
                        strokeWidth={2}
                        fill="url(#colorCredits)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </Card>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card className="bg-[#2a2a2a] border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
                <div className="space-y-4">
                  {mockRecentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                      <div>
                        <div className="text-sm text-white">{activity.description}</div>
                        <div className="text-xs text-gray-400">{activity.date}</div>
                      </div>
                      <div className={`text-sm font-medium ${activity.positive ? 'text-green-400' : 'text-red-400'}`}>
                        {activity.amount}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Quick Actions */}
              <Card className="bg-[#2a2a2a] border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white justify-start">
                    <Zap className="w-4 h-4 mr-2" />
                    Top Up Credits
                  </Button>
                  <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10 justify-start">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Buy Credits
                  </Button>
                  <div className="pt-2">
                    <div className="text-sm text-gray-400 mb-2">Promo code</div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code"
                        className="bg-[#1a1a1a] border-white/10 text-white placeholder-gray-500 flex-1"
                      />
                      <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 shrink-0">
                        <span className="hidden sm:inline">Apply Code</span>
                        <span className="sm:hidden">Apply</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Payment Methods */}
              <Card className="bg-[#2a2a2a] border-white/10 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Payment Methods</h3>
                  <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                    Add New
                  </Button>
                </div>
                <div className="space-y-3">
                  {mockPaymentMethods.map((method, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1a] border border-white/10">
                      <div className="w-8 h-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded flex items-center justify-center">
                        <span className="text-xs font-bold text-white">
                          {method.type === 'visa' ? 'V' : 'M'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-white">
                          {method.type === 'visa' ? 'Visa' : 'Mastercard'} ••••{method.last4}
                        </div>
                        {method.primary && (
                          <div className="text-xs text-blue-400">Primary</div>
                        )}
                      </div>
                      <MoreHorizontal className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Billing Summary */}
              <Card className="bg-[#2a2a2a] border-white/10 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Billing Summary</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Next invoice</span>
                    <span className="text-sm text-white">2024-02-15</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Auto-renew</span>
                    <Switch 
                      checked={autoRenew} 
                      onCheckedChange={setAutoRenew}
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </div>
                </div>
              </Card>
            </div>

            {/* VSCode Extension Integration */}
            <Card className="bg-[#2a2a2a] border-white/10 p-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">VSCode Extension</h3>
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
              
              <div className="space-y-4">
                <div className="text-sm text-gray-400 mb-3">
                  Generate an authentication token to connect your VSCode extension to your account.
                </div>
                
                {!extensionToken ? (
                  <Button
                    onClick={generateToken}
                    disabled={isGenerating}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Generating Token...
                      </>
                    ) : (
                      <>
                        <Code className="w-4 h-4 mr-2" />
                        Generate Extension Token
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-white">Your Extension Token:</div>
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
                      This is your Clerk session token. Use this token in your VSCode extension settings.
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Organizations */}
            <Card className="bg-[#2a2a2a] border-white/10 p-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Organizations</h3>
                <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                  Manage
                </Button>
              </div>
              <div className="text-sm text-gray-400">
                No organizations yet. Create or join an organization to collaborate with your team.
              </div>
            </Card>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default Dashboard;