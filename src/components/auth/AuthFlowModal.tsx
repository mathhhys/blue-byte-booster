import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, ArrowRight, Users, Minus, Plus } from 'lucide-react';
import { useUser, useSignIn, useSignUp } from '@clerk/clerk-react';
import { PLAN_CONFIGS, formatPlanPrice, calculateSavings } from '@/config/plans';
import { AuthFlowState } from '@/types/database';
import { createCheckoutSession, prepareCheckoutData } from '@/utils/stripe/checkout';
// Removed direct database import - now using API routes
import { processStarterSignup, prepareStarterSignupData } from '@/utils/starter/signup';

interface AuthFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerPlan?: 'starter' | 'pro' | 'teams';
}

export const AuthFlowModal: React.FC<AuthFlowModalProps> = ({
  isOpen,
  onClose,
  triggerPlan
}) => {
  const { user, isLoaded } = useUser();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const [state, setState] = useState<AuthFlowState>({
    isOpen: false,
    selectedPlan: triggerPlan || 'pro',
    billingFrequency: 'monthly',
    seats: 1,
    isLoading: false,
  });

  const [showSeatSelector, setShowSeatSelector] = useState(false);

  useEffect(() => {
    setState(prev => ({ ...prev, isOpen }));
  }, [isOpen]);

  useEffect(() => {
    if (triggerPlan) {
      setState(prev => ({ ...prev, selectedPlan: triggerPlan }));
    }
  }, [triggerPlan]);

  const plans = [
    PLAN_CONFIGS.starter,
    PLAN_CONFIGS.pro,
    PLAN_CONFIGS.teams,
  ];

  const handlePlanSelect = (planId: 'starter' | 'pro' | 'teams') => {
    setState(prev => ({ ...prev, selectedPlan: planId }));
    
    if (planId === 'teams') {
      setShowSeatSelector(true);
    } else {
      setShowSeatSelector(false);
      setState(prev => ({ ...prev, seats: 1 }));
    }
  };

  const handleBillingFrequencyChange = (frequency: 'monthly' | 'yearly') => {
    setState(prev => ({ ...prev, billingFrequency: frequency }));
  };

  const handleSeatsChange = (newSeats: number) => {
    if (newSeats >= 1 && newSeats <= 100) {
      setState(prev => ({ ...prev, seats: newSeats }));
    }
  };

  const handleAuthAndPurchase = async () => {
    if (!state.selectedPlan) return;

    setState(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      // If user is not authenticated, redirect to sign-up/sign-in
      if (!isLoaded || !user) {
        const redirectUrl = window.location.href;
        const params = new URLSearchParams();
        
        if (state.selectedPlan !== 'starter') {
          params.set('plan', state.selectedPlan);
          params.set('billing', state.billingFrequency);
          params.set('seats', state.seats.toString());
        }
        params.set('redirect_url', redirectUrl);
        
        // Redirect to sign-up with plan context
        window.location.href = `/sign-up?${params.toString()}`;
        return;
      }

      // User is authenticated, proceed with plan logic
      await processPlanSelection();
    } catch (error) {
      console.error('Error in auth and purchase flow:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'An error occurred',
        isLoading: false 
      }));
    }
  };

  const processPlanSelection = async () => {
    if (!user || !state.selectedPlan) return;

    try {
      switch (state.selectedPlan) {
        case 'starter':
          await handleStarterPlan();
          break;
        case 'pro':
          await handleProPlan();
          break;
        case 'teams':
          await handleTeamsPlan();
          break;
      }
    } catch (error) {
      throw error;
    }
  };

  const handleStarterPlan = async () => {
    if (!user) return;

    try {
      // Use the new starter plan backend endpoint
      const starterData = prepareStarterSignupData({
        id: user.id,
        emailAddresses: user.emailAddresses,
        firstName: user.firstName,
        lastName: user.lastName,
      });

      const result = await processStarterSignup(starterData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to process starter plan signup');
      }

      // Close modal and redirect to dashboard
      onClose();
      window.location.href = '/dashboard';
    } catch (error) {
      throw new Error('Failed to set up starter plan');
    }
  };

  const handleProPlan = async () => {
    if (!user) return;

    try {
      // Initialize user via API route to avoid RLS issues
      const initResponse = await fetch('/api/user/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clerkUser: {
            id: user.id,
            emailAddresses: user.emailAddresses,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          planType: 'pro'
        }),
      });
      
      const { user: newUser, error: initError } = await initResponse.json();
      if (initError) {
        throw new Error(initError.message || 'Failed to initialize user');
      }

      // Create Stripe checkout session
      const checkoutData = prepareCheckoutData(
        'pro',
        state.billingFrequency,
        user.id,
        1
      );

      const result = await createCheckoutSession(checkoutData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create checkout session');
      }

      // Checkout session creation will redirect to Stripe
    } catch (error) {
      throw new Error('Failed to process Pro plan purchase');
    }
  };

  const handleTeamsPlan = async () => {
    if (!user) return;

    try {
      // Initialize user via API route to avoid RLS issues
      const initResponse = await fetch('/api/user/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clerkUser: {
            id: user.id,
            emailAddresses: user.emailAddresses,
            firstName: user.firstName,
            lastName: user.lastName,
          },
          planType: 'teams'
        }),
      });
      
      const { user: newUser, error: initError } = await initResponse.json();
      if (initError) {
        throw new Error(initError.message || 'Failed to initialize user');
      }

      // Create Stripe checkout session with seat count
      const checkoutData = prepareCheckoutData(
        'teams',
        state.billingFrequency,
        user.id,
        state.seats
      );

      const result = await createCheckoutSession(checkoutData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create checkout session');
      }

      // Checkout session creation will redirect to Stripe
    } catch (error) {
      throw new Error('Failed to process Teams plan purchase');
    }
  };

  const getButtonText = () => {
    if (state.isLoading) return 'Processing...';
    
    if (!isLoaded || !user) {
      return state.selectedPlan === 'starter' ? 'Get Started Free' : 'Sign Up & Subscribe';
    }
    
    switch (state.selectedPlan) {
      case 'starter':
        return 'Get Started Free';
      case 'pro':
        return 'Subscribe to Pro';
      case 'teams':
        return 'Subscribe to Teams';
      default:
        return 'Continue';
    }
  };

  const getPriceDisplay = (plan: typeof PLAN_CONFIGS.starter) => {
    if (plan.id === 'starter') return 'Free';
    
    const price = state.billingFrequency === 'monthly' ? plan.price.monthly : plan.price.yearly;
    const period = state.billingFrequency === 'monthly' ? 'mo' : 'yr';
    
    if (plan.id === 'teams' && state.seats > 1) {
      const total = price * state.seats;
      return `$${total}/${period}`;
    }
    
    return `$${price}/${period}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white text-center">
            Choose Your Plan
          </DialogTitle>
          <p className="text-gray-300 text-center">
            Select the perfect plan for your coding journey
          </p>
        </DialogHeader>

        {/* Billing Frequency Toggle */}
        <div className="flex justify-center items-center mb-8">
          <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-600">
            <button
              onClick={() => handleBillingFrequencyChange('monthly')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                state.billingFrequency === 'monthly'
                  ? "bg-white text-black"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              MONTHLY
            </button>
            <button
              onClick={() => handleBillingFrequencyChange('yearly')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                state.billingFrequency === 'yearly'
                  ? "bg-white text-black"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              YEARLY <span className="text-gray-400">(SAVE 20%)</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative p-6 border transition-all duration-300 cursor-pointer ${
                state.selectedPlan === plan.id
                  ? 'border-blue-500 ring-2 ring-blue-500/20'
                  : 'border-transparent hover:border-gray-600'
              }`}
              style={plan.isPopular ? {
                background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 25%, #3b82f6 50%, #1e40af 75%, #1e3a8a 100%)"
              } : {
                background: "linear-gradient(135deg, #0A0F1C 0%, #0F1929 25%, #1A2332 50%, #0F1929 75%, #0A0F1C 100%)"
              }}
              onClick={() => handlePlanSelect(plan.id)}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-3xl font-bold text-white">
                      {getPriceDisplay(plan)}
                    </span>
                    {plan.price.monthly > 0 && (
                      <span className="text-gray-300">
                        /{state.billingFrequency === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-300">
                    {plan.description}
                  </p>
                </div>

                <div className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-200">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Seat Selector for Teams Plan */}
        {showSeatSelector && state.selectedPlan === 'teams' && (
          <div className="bg-slate-800 rounded-lg p-6 mb-6">
            <h4 className="text-lg font-semibold text-white mb-4">
              How many team members?
            </h4>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSeatsChange(state.seats - 1)}
                disabled={state.seats <= 1}
                className="border-gray-600 text-white hover:bg-gray-700"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-400" />
                <span className="text-xl font-semibold text-white min-w-[3ch] text-center">
                  {state.seats}
                </span>
                <span className="text-gray-400">
                  seat{state.seats > 1 ? 's' : ''}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSeatsChange(state.seats + 1)}
                disabled={state.seats >= 100}
                className="border-gray-600 text-white hover:bg-gray-700"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              Total: {getPriceDisplay(PLAN_CONFIGS.teams)} for {state.seats} seat{state.seats > 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Error Display */}
        {state.error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-300 text-sm">{state.error}</p>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleAuthAndPurchase}
            disabled={state.isLoading || !state.selectedPlan}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-medium"
          >
            <ArrowRight className="w-5 h-5 mr-2" />
            {getButtonText()}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};