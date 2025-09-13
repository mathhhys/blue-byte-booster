import { useState, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { AuthFlowState } from '@/types/database';
import { createCheckoutSession, prepareCheckoutData } from '@/utils/stripe/checkout';
// Removed direct database import - now using API routes

export const useAuthFlow = () => {
  const { user, isLoaded } = useUser();
  
  const [state, setState] = useState<AuthFlowState>({
    isOpen: false,
    selectedPlan: 'pro',
    billingFrequency: 'monthly',
    seats: 1,
    isLoading: false,
  });

  const openModal = useCallback((plan?: 'starter' | 'pro' | 'teams') => {
    setState(prev => ({
      ...prev,
      isOpen: true,
      selectedPlan: plan || 'pro',
      error: undefined,
    }));
  }, []);

  const closeModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      error: undefined,
    }));
  }, []);

  const selectPlan = useCallback((planId: 'starter' | 'pro' | 'teams') => {
    setState(prev => ({
      ...prev,
      selectedPlan: planId,
      seats: planId === 'teams' ? prev.seats : 1,
    }));
  }, []);

  const setBillingFrequency = useCallback((frequency: 'monthly' | 'yearly') => {
    setState(prev => ({ ...prev, billingFrequency: frequency }));
  }, []);

  const setSeats = useCallback((seats: number) => {
    if (seats >= 1 && seats <= 100) {
      setState(prev => ({ ...prev, seats }));
    }
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  }, []);

  const setError = useCallback((error?: string) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const processStarterPlan = useCallback(async () => {
    if (!user) throw new Error('User not authenticated');

    try {
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
          planType: 'starter'
        }),
      });
      
      const { user: dbUser, error } = await initResponse.json();
      if (error) throw new Error('Failed to initialize user account');

      return { success: true, redirectUrl: '/dashboard' };
    } catch (error) {
      throw new Error('Failed to set up starter plan');
    }
  }, [user]);

  const processProPlan = useCallback(async () => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Initialize user via API route
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

      return { success: true, sessionId: result.sessionId };
    } catch (error) {
      throw new Error('Failed to process Pro plan purchase');
    }
  }, [user, state.billingFrequency]);

  const processTeamsPlan = useCallback(async () => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Initialize user via API route
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

      return { success: true, sessionId: result.sessionId };
    } catch (error) {
      throw new Error('Failed to process Teams plan purchase');
    }
  }, [user, state.billingFrequency, state.seats]);

  const handleAuthAndPurchase = useCallback(async () => {
    if (!state.selectedPlan) return;

    setLoading(true);
    setError(undefined);

    try {
      // If user is not authenticated, redirect to sign-up/sign-in
      if (!isLoaded || !user) {
        const currentUrl = window.location.href;
        const planParams = new URLSearchParams({
          plan: state.selectedPlan,
          billing: state.billingFrequency,
          seats: state.seats.toString(),
          redirect_url: currentUrl,
        });
        
        window.location.href = `/sign-up?${planParams.toString()}`;
        return;
      }

      // User is authenticated, proceed with plan logic
      let result;
      
      switch (state.selectedPlan) {
        case 'starter':
          result = await processStarterPlan();
          if (result.success && result.redirectUrl) {
            closeModal();
            window.location.href = result.redirectUrl;
          }
          break;
        case 'pro':
          result = await processProPlan();
          // Stripe checkout will handle the redirect
          break;
        case 'teams':
          result = await processTeamsPlan();
          // Stripe checkout will handle the redirect
          break;
      }
    } catch (error) {
      console.error('Error in auth and purchase flow:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [
    state.selectedPlan,
    state.billingFrequency,
    state.seats,
    isLoaded,
    user,
    processStarterPlan,
    processProPlan,
    processTeamsPlan,
    closeModal,
  ]);

  const getButtonText = useCallback(() => {
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
  }, [state.isLoading, state.selectedPlan, isLoaded, user]);

  return {
    state,
    actions: {
      openModal,
      closeModal,
      selectPlan,
      setBillingFrequency,
      setSeats,
      setLoading,
      setError,
      handleAuthAndPurchase,
    },
    computed: {
      getButtonText,
      isAuthenticated: isLoaded && !!user,
    },
  };
};