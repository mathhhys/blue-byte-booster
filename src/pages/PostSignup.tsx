import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { createMultiCurrencyCheckoutSession, prepareMultiCurrencyCheckoutData, createCheckoutSession, prepareCheckoutData } from '@/utils/stripe/checkout';
// Removed direct database import - now using API routes
import { processStarterSignup, prepareStarterSignupData } from '@/utils/starter/signup';
import { CurrencyCode } from '@/types/database';
import { isSupportedCurrency } from '@/config/currencies';

const PostSignup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  
  const [status, setStatus] = useState<'loading' | 'processing' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  
  const plan = searchParams.get('plan') as 'starter' | 'pro' | 'teams' | null;
  const billing = searchParams.get('billing') as 'monthly' | 'yearly' || 'monthly';
  const currencyParam = searchParams.get('currency');
  const currency: CurrencyCode = (currencyParam && isSupportedCurrency(currencyParam)) ? currencyParam : 'EUR';
  const seats = parseInt(searchParams.get('seats') || '1');
  const originalRedirect = searchParams.get('original_redirect');

  useEffect(() => {
    if (isLoaded && user && plan) {
      processPlanSelection();
    } else if (isLoaded && !user) {
      // User not authenticated, redirect to sign-up
      navigate('/sign-up');
    } else if (isLoaded && user && !plan) {
      // No plan selected, redirect to dashboard
      navigate('/dashboard');
    }
  }, [isLoaded, user, plan]);

  const processPlanSelection = async () => {
    if (!user || !plan) return;

    setStatus('processing');

    try {
      if (plan === 'starter') {
        // For starter plan, use the dedicated backend endpoint
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

        setStatus('success');
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
        return;
      }

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
          planType: plan
        }),
      });
      
      const { user: newUser, error: initError } = await initResponse.json();
      if (initError) {
        throw new Error(initError.message || 'Failed to initialize user');
      }

      // For paid plans, create checkout session with currency support
      const checkoutData = prepareMultiCurrencyCheckoutData(
        plan,
        billing,
        currency,
        user.id,
        seats
      );

      const result = await createMultiCurrencyCheckoutSession(checkoutData);
      
      if (!result.success) {
        throw new Error((result as any).error || 'Failed to create checkout session');
      }

      setStatus('success');
      // The createCheckoutSession function will handle the redirect to Stripe
    } catch (error) {
      console.error('Error processing plan selection:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      setStatus('error');
    }
  };

  const handleRetry = () => {
    setError('');
    setStatus('loading');
    processPlanSelection();
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <div className="flex items-center space-x-2 text-white">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <Card className="w-full max-w-md bg-slate-800/50 backdrop-blur-lg border border-white/10 shadow-2xl p-8">
        <div className="text-center">
          <img
            src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-logo/softcodes%20logo%20navbar%20desktop%20not%20scrolled.svg"
            alt="Softcodes Logo"
            className="h-8 w-auto mx-auto mb-6"
          />

          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Setting up your account...
              </h2>
              <p className="text-gray-300">
                Please wait while we prepare your {plan} plan.
              </p>
            </>
          )}

          {status === 'processing' && (
            <>
              <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Processing your subscription...
              </h2>
              <p className="text-gray-300">
                Redirecting you to secure checkout.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                {plan === 'starter' ? 'Account created successfully!' : 'Redirecting to checkout...'}
              </h2>
              <p className="text-gray-300">
                {plan === 'starter' 
                  ? 'Welcome to Softcodes! Taking you to your dashboard.'
                  : 'You will be redirected to complete your payment shortly.'
                }
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Something went wrong
              </h2>
              <p className="text-gray-300 mb-6">
                {error || 'We encountered an error while setting up your account.'}
              </p>
              <div className="space-y-3">
                <Button 
                  onClick={handleRetry}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Try Again
                </Button>
                <Button 
                  onClick={handleGoToDashboard}
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10"
                >
                  Go to Dashboard
                </Button>
              </div>
            </>
          )}

          {plan && status !== 'error' && (
            <div className="mt-6 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg">
              <p className="text-blue-300 text-sm">
                Plan: <span className="font-semibold capitalize">{plan}</span>
                {billing && <span className="ml-2">({billing})</span>}
                {currency && <span className="ml-2">- {currency}</span>}
                {seats > 1 && <span className="ml-2">- {seats} seats</span>}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default PostSignup;