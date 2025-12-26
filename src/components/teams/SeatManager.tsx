import React, { useState, useEffect } from 'react';
import { useOrganization, useAuth } from '@clerk/clerk-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Plus,
  Trash2,
  Mail,
  UserPlus,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Crown,
} from 'lucide-react';

interface Seat {
  user_id: string | null;
  email: string;
  status: string;
  role: string | null;
  assigned_at: string;
}

interface SeatData {
  seats_used: number;
  seats_total: number;
  seats: Seat[];
}

async function readErrorMessage(response: Response): Promise<string> {
  const anyRes: any = response as any;

  try {
    if (typeof anyRes.text === 'function') {
      const text = await anyRes.text();
      if (!text) {
        return `HTTP ${anyRes.status || 'error'}`;
      }

      try {
        const parsed = JSON.parse(text);
        return parsed?.error || parsed?.message || text;
      } catch {
        return text;
      }
    }

    if (typeof anyRes.json === 'function') {
      const parsed = await anyRes.json();
      return parsed?.error || parsed?.message || JSON.stringify(parsed);
    }
  } catch {
    // ignore parsing errors
  }

  return `HTTP ${anyRes.status || 'error'}`;
}

export const SeatManager: React.FC = () => {
  const { organization } = useOrganization();
  const { userId, getToken } = useAuth();
  const { toast } = useToast();
  const [seatsData, setSeatsData] = useState<SeatData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [assignEmail, setAssignEmail] = useState('');
  const [assignRole, setAssignRole] = useState('org:member');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showBuySeatsModal, setShowBuySeatsModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('basic_member');
  const [buySeatsQuantity, setBuySeatsQuantity] = useState(1);

  useEffect(() => {
    if (organization?.id) {
      loadSeats();
    }
  }, [organization?.id]);

  const loadSeats = async () => {
    if (!organization?.id) return;
    
    setIsLoading(true);
    try {
      const token = await getToken();
      console.log('🔍 DEBUG: SeatManager - Got auth token for seats call:', token ? 'Present' : 'Missing');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_BASE}/api/organizations/seats?org_id=${organization.id}`, {
        headers
      });
      
      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message || `Failed to fetch seats: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('🔍 DEBUG: SeatManager - API response data:', data);
      setSeatsData(data.data);
    } catch (error) {
      console.error('Error loading seats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!organization?.id || !inviteEmail.trim()) return;

    setIsAssigning(true);
    try {
      const token = await getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const API_BASE = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_BASE}/api/organizations/invite`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orgId: organization.id,
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      if (!response.ok) {
        const message = await readErrorMessage(response);
        console.error('❌ Invitation failed:', message);
        throw new Error(message || 'Failed to send invitation');
      }

      toast({
        title: "Success",
        description: `Invitation sent to ${inviteEmail}`,
      });

      setInviteEmail('');
      setShowInviteModal(false);
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to send invitation',
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAssignSeat = async () => {
    if (!organization?.id || !assignEmail.trim()) return;

    setIsAssigning(true);
    try {
      const token = await getToken();
      console.log('🔍 DEBUG: SeatManager - Got auth token for assign:', token ? 'Present' : 'Missing');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_BASE}/api/organizations/seats/assign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          org_id: organization.id,
          email: assignEmail,
          role: assignRole,
        }),
      });

      if (response.status === 402) {
        setShowBuySeatsModal(true);
        return;
      }

      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message || 'Failed to assign seat');
      }

      toast({
        title: "Success",
        description: `Seat assigned to ${assignEmail}`,
      });

      setAssignEmail('');
      setAssignRole('member');
      setShowAssignModal(false);
      await loadSeats();
    } catch (error) {
      console.error('Error assigning seat:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to assign seat',
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRevokeSeat = async (userId: string, email: string) => {
    if (!organization?.id) return;

    setIsRevoking(true);
    try {
      const token = await getToken();
      console.log('🔍 DEBUG: SeatManager - Got auth token for revoke:', token ? 'Present' : 'Missing');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const API_BASE = import.meta.env.VITE_API_URL || '';
      const response = await fetch(
        `${API_BASE}/api/organizations/seats/${encodeURIComponent(userId)}?orgId=${encodeURIComponent(organization.id)}`,
        {
          method: 'DELETE',
          headers
        }
      );

      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message || 'Failed to revoke seat');
      }

      toast({
        title: "Success",
        description: `Seat revoked from ${email}`,
      });

      await loadSeats();
    } catch (error) {
      console.error('Error revoking seat:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to revoke seat',
        variant: "destructive",
      });
    } finally {
      setIsRevoking(false);
    }
  };

  const handleBuySeats = async (quantity: number = 1) => {
    if (!organization?.id) return;

    setIsAssigning(true);
    try {
      const token = await getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const API_BASE = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${API_BASE}/api/organizations/buy-seats`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orgId: organization.id,
          clerkUserId: userId,
          quantity,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      toast({
        title: "Error",
        description: "Failed to create checkout session",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'revoked':
      case 'expired':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <CheckCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-blue-600 text-white"><Crown className="w-3 h-3 mr-1" />Admin</Badge>;
      case 'member':
        return <Badge variant="secondary">Member</Badge>;
      default:
        return <Badge variant="outline">{role || 'Unknown'}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-[#2a2a2a] border-white/10 p-6">
        <div className="space-y-4">
          <div className="h-6 bg-gray-600 rounded animate-pulse w-1/3"></div>
          <div className="h-4 bg-gray-600 rounded animate-pulse w-3/4"></div>
          <div className="h-4 bg-gray-600 rounded animate-pulse w-1/2"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-[#2a2a2a] border-white/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Seat Management</h3>
          {seatsData && (
            <p className="text-sm text-gray-400">
              {seatsData.seats_used} of {seatsData.seats_total} seats used
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
          <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                <Mail className="w-4 h-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#2a2a2a] border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>Invite New Member</DialogTitle>
                <DialogDescription>Send an invitation to join the organization.</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="invite-email" className="text-white">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="Enter email address"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="bg-[#1a1a1a] border-white/10 text-white mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="invite-role" className="text-white">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="bg-[#1a1a1a] border-white/10 text-white mt-1">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2a2a2a] border-white/10 text-white">
                      <SelectItem value="basic_member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowInviteModal(false)}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInvite}
                  disabled={isAssigning || !inviteEmail.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isAssigning ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4 mr-2" />
                  )}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <UserPlus className="w-4 h-4 mr-2" />
                Assign Seat
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#2a2a2a] border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>Assign New Seat</DialogTitle>
                <DialogDescription>Assign a new seat to a team member by entering their email address and role.</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-white">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter user's email address"
                    value={assignEmail}
                    onChange={(e) => setAssignEmail(e.target.value)}
                    className="bg-[#1a1a1a] border-white/10 text-white mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="role" className="text-white">Role</Label>
                  <Select value={assignRole} onValueChange={setAssignRole}>
                    <SelectTrigger className="bg-[#1a1a1a] border-white/10 text-white mt-1">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2a2a2a] border-white/10 text-white">
                      <SelectItem value="org:member">Member</SelectItem>
                      <SelectItem value="org:admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowAssignModal(false)}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAssignSeat}
                  disabled={isAssigning || !assignEmail.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isAssigning ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  Assign Seat
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={showBuySeatsModal} onOpenChange={setShowBuySeatsModal}>
          <DialogContent className="bg-[#2a2a2a] border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Buy Additional Seats</DialogTitle>
              <DialogDescription>Purchase additional seats for your team.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {seatsData && (
                <div className="text-sm text-gray-400">
                  Current: {seatsData.seats_used} of {seatsData.seats_total} seats used
                </div>
              )}

              <div>
                <Label htmlFor="quantity" className="text-white">Number of Seats</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="100"
                  value={buySeatsQuantity}
                  onChange={(e) => setBuySeatsQuantity(parseInt(e.target.value) || 1)}
                  className="bg-[#1a1a1a] border-white/10 text-white mt-1"
                />
              </div>

              <div className="text-sm text-gray-300">
                <p>Pricing: $30/seat/month or $288/seat/year</p>
                <p className="mt-2">You'll be redirected to Stripe checkout to complete the purchase.</p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowBuySeatsModal(false)}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleBuySeats(buySeatsQuantity)}
                disabled={isAssigning || buySeatsQuantity < 1}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isAssigning ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Buy Seats
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {seatsData && (
        <div className="space-y-4">
          {/* Seat Usage Progress */}
          <div className="bg-[#1a1a1a] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium">Seat Usage</span>
              <span className="text-gray-300">
                {seatsData.seats_used} / {seatsData.seats_total} seats
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  (seatsData.seats_used / seatsData.seats_total) > 0.8 
                    ? 'bg-red-500' 
                    : (seatsData.seats_used / seatsData.seats_total) > 0.6 
                    ? 'bg-yellow-500' 
                    : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min((seatsData.seats_used / seatsData.seats_total) * 100, 100)}%` }}
              />
            </div>
            <p className="text-sm text-gray-400 mt-2">
              {seatsData.seats_total - seatsData.seats_used} seats available
            </p>
          </div>

          {/* Seats List */}
          <div>
            <h4 className="text-white font-medium mb-3">Assigned Seats</h4>
            {(!seatsData.seats || seatsData.seats.length === 0) ? (
              <div className="text-center py-8 text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No seats assigned yet</p>
                <p className="text-sm">Assign your first seat to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {seatsData.seats.map((seat) => (
                  <div
                    key={seat.user_id ?? seat.email}
                    className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(seat.status)}
                      <div>
                        <p className="text-white font-medium">{seat.email}</p>
                        <p className="text-sm text-gray-400">
                          Assigned {new Date(seat.assigned_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {getRoleBadge(seat.role)}
                      
                      {seat.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => seat.user_id && handleRevokeSeat(seat.user_id, seat.email)}
                          disabled={isRevoking || !seat.user_id}
                          className="border-red-500/30 text-red-400 hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};