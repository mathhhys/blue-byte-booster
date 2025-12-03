import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKindeAuthContext } from '@/contexts/KindeAuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
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
  Building2,
  DollarSign,
  Plus,
  Crown,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  LogOut,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Seat {
  user_id: string;
  email: string;
  status: string;
  role: string | null;
  assigned_at: string;
}

interface SubscriptionData {
  id: string;
  seats_total: number;
  seats_used: number;
  plan_type: string;
  status: string;
  billing_frequency: string;
  current_period_end: string;
}

const TeamsDashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, user, organization, logout, getToken } = useKindeAuthContext();
  const { toast } = useToast();
  
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/teams/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (isAuthenticated && organization) {
      loadOrganizationData();
    }
  }, [isAuthenticated, organization]);

  const loadOrganizationData = async () => {
    if (!organization?.orgCode) return;
    
    setIsLoading(true);
    try {
      const token = await getToken();
      const API_BASE = import.meta.env.VITE_API_URL || '';
      
      // Load subscription data
      const subResponse = await fetch(
        `${API_BASE}/api/kinde/organizations/${organization.orgCode}/subscription`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (subResponse.ok) {
        const subData = await subResponse.json();
        setSubscriptionData(subData.subscription);
      } else if (subResponse.status === 404) {
        // No subscription, redirect to subscribe page
        navigate('/teams/subscribe');
        return;
      }

      // Load seats data
      const seatsResponse = await fetch(
        `${API_BASE}/api/kinde/organizations/${organization.orgCode}/seats`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (seatsResponse.ok) {
        const seatsData = await seatsResponse.json();
        setSeats(seatsData.seats || []);
      }
    } catch (error) {
      console.error('Error loading organization data:', error);
      toast({
        title: "Error",
        description: "Failed to load organization data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail.trim() || !organization?.orgCode) return;
    
    setIsInviting(true);
    try {
      const token = await getToken();
      const API_BASE = import.meta.env.VITE_API_URL || '';
      
      const response = await fetch(
        `${API_BASE}/api/kinde/organizations/${organization.orgCode}/seats/assign`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: inviteEmail,
            role: 'member',
          }),
        }
      );
      
      if (response.status === 402) {
        toast({
          title: "No Available Seats",
          description: "Please purchase additional seats to invite more members.",
          variant: "destructive",
        });
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to invite member');
      }
      
      toast({
        title: "Success",
        description: `Invitation sent to ${inviteEmail}`,
      });
      
      setInviteEmail('');
      loadOrganizationData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to invite member',
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleBuySeats = async () => {
    if (!organization?.orgCode) return;
    
    try {
      const token = await getToken();
      const API_BASE = import.meta.env.VITE_API_URL || '';
      
      const response = await fetch(
        `${API_BASE}/api/kinde/organizations/${organization.orgCode}/buy-seats`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quantity: 1,
            successUrl: `${window.location.origin}/teams/dashboard?seats_added=true`,
            cancelUrl: `${window.location.origin}/teams/dashboard`,
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }
      
      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create checkout session",
        variant: "destructive",
      });
    }
  };

  const handleManageBilling = async () => {
    if (!organization?.orgCode) return;
    
    try {
      const token = await getToken();
      const API_BASE = import.meta.env.VITE_API_URL || '';
      
      const response = await fetch(
        `${API_BASE}/api/kinde/organizations/${organization.orgCode}/billing-portal`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to open billing portal');
      }
      
      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open billing portal",
        variant: "destructive",
      });
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-white/70">Loading your organization...</p>
        </div>
      </div>
    );
  }

  const availableSeats = subscriptionData 
    ? subscriptionData.seats_total - (subscriptionData.seats_used || seats.length)
    : 0;
  const percentUsed = subscriptionData 
    ? Math.round((subscriptionData.seats_used / subscriptionData.seats_total) * 100)
    : 0;

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
              <span className="font-semibold text-white">Softcodes Teams</span>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-4">
            {/* Organization Info */}
            <div className="mb-6 p-3 bg-[#2a2a2a] rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span className="text-white font-medium text-sm">
                  {organization?.orgName || 'Your Organization'}
                </span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {organization?.orgCode}
              </Badge>
            </div>

            {/* Navigation Menu */}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive 
                  className="bg-blue-600/20 text-white"
                >
                  <Home className="w-4 h-4" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton 
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Users className="w-4 h-4" />
                  <span>Team Members</span>
                  <SidebarMenuBadge>{seats.length}</SidebarMenuBadge>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={handleManageBilling}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Billing</span>
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
                    <span>Documentation</span>
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
            <Button 
              onClick={() => logout()}
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
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
                  <span>Teams</span>
                  <span>{'>'}</span>
                  <span className="text-white">Dashboard</span>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Notifications */}
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white relative">
                  <Bell className="w-4 h-4" />
                </Button>

                {/* User Info */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    {user?.given_name?.[0] || user?.email?.[0] || 'U'}
                  </div>
                  <span className="text-white text-sm hidden md:block">
                    {user?.given_name || user?.email}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6">
            <div className="max-w-6xl mx-auto">
              {/* Page Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">
                  Team Dashboard
                </h1>
                <p className="text-gray-400">
                  Manage your team, seats, and billing in one place.
                </p>
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                {/* Subscription Overview */}
                <Card className="lg:col-span-2 bg-[#2a2a2a] border-white/10 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Subscription</h3>
                    <Badge className="bg-green-600 text-white">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                  
                  {subscriptionData && (
                    <div className="grid md:grid-cols-3 gap-6">
                      <div>
                        <div className="text-sm text-gray-400 mb-1">Plan</div>
                        <div className="text-xl font-semibold text-white capitalize">
                          {subscriptionData.plan_type}
                        </div>
                        <div className="text-sm text-gray-400">
                          €30/seat/month
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-400 mb-1">Seat Usage</div>
                        <div className="text-xl font-semibold text-white">
                          {subscriptionData.seats_used || seats.length}/{subscriptionData.seats_total}
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
                        <div className="text-sm text-gray-400 mb-1">Next Billing</div>
                        <div className="text-xl font-semibold text-white">
                          {subscriptionData.current_period_end 
                            ? new Date(subscriptionData.current_period_end).toLocaleDateString()
                            : 'N/A'
                          }
                        </div>
                        <div className="text-sm text-gray-400">
                          {subscriptionData.billing_frequency}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <Button
                      onClick={handleManageBilling}
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Manage Billing
                    </Button>
                    <Button
                      onClick={handleBuySeats}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Seats
                    </Button>
                  </div>
                </Card>

                {/* Quick Actions */}
                <Card className="bg-[#2a2a2a] border-white/10 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                  
                  <div className="space-y-3">
                    {availableSeats > 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm text-gray-400">
                          {availableSeats} seat{availableSeats !== 1 ? 's' : ''} available
                        </p>
                        <Input
                          type="email"
                          placeholder="Email address"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="bg-[#1a1a1a] border-white/10 text-white"
                        />
                        <Button
                          onClick={handleInviteMember}
                          disabled={isInviting || !inviteEmail.trim()}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {isInviting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4 mr-2" />
                          )}
                          Invite Member
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-400 mb-3">
                          All seats are assigned
                        </p>
                        <Button
                          onClick={handleBuySeats}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Buy More Seats
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Team Members */}
              <Card className="bg-[#2a2a2a] border-white/10 p-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Team Members</h3>
                  <span className="text-sm text-gray-400">
                    {seats.length} member{seats.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {seats.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No team members yet</p>
                    <p className="text-sm mt-1">Invite your first team member above</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {seats.map((seat) => (
                      <div
                        key={seat.user_id}
                        className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            {seat.role === 'admin' ? (
                              <Crown className="w-4 h-4 text-white" />
                            ) : (
                              seat.email[0].toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-white font-medium">{seat.email}</p>
                            <p className="text-sm text-gray-400">
                              Added {new Date(seat.assigned_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={seat.role === 'admin' ? 'default' : 'secondary'}
                            className={seat.role === 'admin' ? 'bg-blue-600 text-white' : ''}
                          >
                            {seat.role === 'admin' ? 'Admin' : 'Member'}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              seat.status === 'active' 
                                ? 'border-green-500/50 text-green-400' 
                                : 'border-yellow-500/50 text-yellow-400'
                            }`}
                          >
                            {seat.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default TeamsDashboard;