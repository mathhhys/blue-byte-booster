import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKindeAuthContext } from '@/contexts/KindeAuthContext';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import GradientBackground from '@/components/GradientBackground';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  Users,
  Check,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

const TeamsSubscribe = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, organization, getToken, logout } = useKindeAuthContext();
  const { toast } = useToast();
  
  const [seats, setSeats] = useState(3);
  const [billingFrequency, setBillingFrequency] = useState<'monthly' | 'yearly'>('monthly');
  const [isCreating, setIsCreating] = useState(false);

  const pricePerSeat = billingFrequency === 'monthly' ? 30 : 288; // €30/month or €288/year (20% discount)
  const totalPrice = seats * pricePerSeat;
  const yearlySavings = seats * (30 * 12 - 288);

  const handleSubscribe = async () => {
    if (!organization?.orgCode) {
      toast({
        title: "Error",
        description: "No organization found. Please create an organization first.",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const token = await getToken();
      const API_BASE = import.meta.env.VITE_API_URL || '';
      
      const response = await fetch(
        `${API_BASE}/api/kinde/organizations/${organization.orgCode}/subscribe`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            seats,
            billingFrequency,
            successUrl: `${window.location.origin}/teams/dashboard?subscription=success`,
            cancelUrl: `${window.location.origin}/teams/subscribe`,
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create subscription');
      }
      
      const data = await response.json();
      window.location.href = data.checkout_url;
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create subscription',
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (authLoading) {
    return (
      <GradientBackground>
        <Navigation />
        <div className="min-h-[80vh] flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
        </div>
        <Footer />
      </GradientBackground>
    );
  }

  if (!isAuthenticated) {
    navigate('/teams/login');
    return null;
  }

  return (
    <GradientBackground>
      <Navigation />
      <div className="min-h-[80vh] py-20">
        <div className="max-w-4xl mx-auto px-6">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => logout()}
            className="mb-6 text-white/70 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 rounded-full px-4 py-2 mb-6">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 text-sm font-medium">
                {organization?.orgName || 'Your Organization'}
              </span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">
              Choose Your Team Plan
            </h1>
            <p className="text-xl text-white/70">
              Select the number of seats for your team
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Configuration Card */}
            <Card className="bg-white/5 border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Configure Your Plan</h3>
              
              {/* Billing Frequency */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-2 block">Billing Frequency</label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={billingFrequency === 'monthly' ? 'default' : 'outline'}
                    onClick={() => setBillingFrequency('monthly')}
                    className={billingFrequency === 'monthly' 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'border-white/20 text-white hover:bg-white/10'
                    }
                  >
                    Monthly
                  </Button>
                  <Button
                    variant={billingFrequency === 'yearly' ? 'default' : 'outline'}
                    onClick={() => setBillingFrequency('yearly')}
                    className={billingFrequency === 'yearly' 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'border-white/20 text-white hover:bg-white/10'
                    }
                  >
                    Yearly (Save 20%)
                  </Button>
                </div>
              </div>

              {/* Seat Count */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-2 block">Number of Seats</label>
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSeats(Math.max(3, seats - 1))}
                    disabled={seats <= 3}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    min="3"
                    max="100"
                    value={seats}
                    onChange={(e) => setSeats(Math.max(3, Math.min(100, parseInt(e.target.value) || 3)))}
                    className="w-24 text-center bg-[#1a1a1a] border-white/10 text-white"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSeats(Math.min(100, seats + 1))}
                    disabled={seats >= 100}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    +
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Minimum 3 seats, maximum 100 seats</p>
              </div>

              {/* Quick Presets */}
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-2 block">Quick Select</label>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 5, 10, 25].map((num) => (
                    <Button
                      key={num}
                      variant={seats === num ? 'default' : 'outline'}
                      onClick={() => setSeats(num)}
                      className={seats === num 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'border-white/20 text-white hover:bg-white/10'
                      }
                      size="sm"
                    >
                      {num} seats
                    </Button>
                  ))}
                </div>
              </div>
            </Card>

            {/* Summary Card */}
            <Card className="bg-white/5 border-white/10 p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Order Summary</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-gray-300">
                  <span>Plan</span>
                  <span>Teams</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Seats</span>
                  <span>{seats}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                  <span>Price per seat</span>
                  <span>€{pricePerSeat}/{billingFrequency === 'monthly' ? 'month' : 'year'}</span>
                </div>
                {billingFrequency === 'yearly' && (
                  <div className="flex justify-between text-green-400">
                    <span>Yearly savings</span>
                    <span>€{yearlySavings}</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-4">
                  <div className="flex justify-between text-white text-lg font-semibold">
                    <span>Total</span>
                    <span>€{totalPrice}/{billingFrequency === 'monthly' ? 'month' : 'year'}</span>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="mb-6 p-4 bg-[#1a1a1a] rounded-lg">
                <p className="text-sm text-gray-400 mb-3">Everything in Pro, plus:</p>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    Centralized billing
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    Team member management
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    Role-based access control
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400" />
                    Priority support
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleSubscribe}
                disabled={isCreating || seats < 3}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Creating subscription...
                  </>
                ) : (
                  <>
                    <Users className="w-5 h-5 mr-2" />
                    Subscribe Now
                  </>
                )}
              </Button>
              
              <p className="text-xs text-gray-500 text-center mt-4">
                You'll be redirected to Stripe for secure payment
              </p>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </GradientBackground>
  );
};

export default TeamsSubscribe;