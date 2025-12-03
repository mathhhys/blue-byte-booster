import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKindeAuthContext } from '@/contexts/KindeAuthContext';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import GradientBackground from '@/components/GradientBackground';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Building2, Users, CreditCard, Shield, ArrowRight, Loader2 } from 'lucide-react';

const TeamsLogin = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, login, register, createOrganization } = useKindeAuthContext();

  useEffect(() => {
    // If already authenticated, redirect to teams dashboard
    if (isAuthenticated && !isLoading) {
      navigate('/teams/dashboard');
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <GradientBackground>
        <Navigation />
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-white/70">Loading...</p>
          </div>
        </div>
        <Footer />
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <Navigation />
      <div className="min-h-[80vh] py-20">
        <div className="max-w-4xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 rounded-full px-4 py-2 mb-6">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 text-sm font-medium">Teams & Organizations</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Softcodes for Teams
            </h1>
            <p className="text-xl text-white/70 max-w-2xl mx-auto">
              Centralized billing, seat management, and admin controls for your entire team.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="bg-white/5 border-white/10 p-6">
              <Users className="w-10 h-10 text-blue-500 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Seat-Based Pricing</h3>
              <p className="text-white/60 text-sm">
                €30/user/month. Add or remove seats as your team grows.
              </p>
            </Card>
            <Card className="bg-white/5 border-white/10 p-6">
              <CreditCard className="w-10 h-10 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Centralized Billing</h3>
              <p className="text-white/60 text-sm">
                One invoice for your entire organization. Easy expense management.
              </p>
            </Card>
            <Card className="bg-white/5 border-white/10 p-6">
              <Shield className="w-10 h-10 text-purple-500 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Admin Controls</h3>
              <p className="text-white/60 text-sm">
                Manage team members, roles, and access from a central dashboard.
              </p>
            </Card>
          </div>

          {/* Auth Buttons */}
          <Card className="bg-white/5 border-white/10 p-8 max-w-lg mx-auto">
            <h2 className="text-2xl font-semibold text-white text-center mb-6">
              Get Started with Teams
            </h2>
            
            <div className="space-y-4">
              <Button 
                onClick={() => createOrganization()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
              >
                <Building2 className="w-5 h-5 mr-2" />
                Create New Organization
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-[#121212] text-white/50">or</span>
                </div>
              </div>
              
              <Button 
                onClick={() => login()}
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10 py-6 text-lg"
              >
                Sign In to Existing Organization
              </Button>
            </div>

            <p className="text-white/50 text-sm text-center mt-6">
              Already have a personal account?{' '}
              <a href="/sign-in" className="text-blue-400 hover:text-blue-300">
                Sign in as an Individual
              </a>
            </p>
          </Card>

          {/* Pricing Info */}
          <div className="text-center mt-12">
            <p className="text-white/50 text-sm">
              Teams plan starts at €30/user/month • Minimum 3 seats • Volume discounts available
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </GradientBackground>
  );
};

export default TeamsLogin;