import { SignUp as ClerkSignUp } from '@clerk/clerk-react';
import { useSearchParams } from 'react-router-dom';
import { dark } from '@clerk/themes';
import { useEffect, useMemo } from 'react';
import { setAuthPageMeta } from '@/utils/seo';

const SignUp = () => {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan');
  const billing = searchParams.get('billing');
  const currency = searchParams.get('currency');
  const seats = searchParams.get('seats');
  const redirectUrl = searchParams.get('redirect_url');

  useEffect(() => {
    setAuthPageMeta('signUp');
  }, []);

  // Build the redirect URL based on plan selection
  const dynamicRedirectUrl = useMemo(() => {
    // Always redirect to post-signup to ensure user is created in database
    const params = new URLSearchParams();
    
    // Set plan (default to starter if not specified)
    params.set('plan', plan || 'starter');
    
    if (billing) params.set('billing', billing);
    if (currency) params.set('currency', currency);
    if (seats) params.set('seats', seats);
    if (redirectUrl) params.set('original_redirect', redirectUrl);
    
    return `/auth/post-signup?${params.toString()}`;
  }, [plan, billing, seats, redirectUrl]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="https://xraquejellmoyrpqcirs.supabase.co/storage/v1/object/public/softcodes-logo/softcodes%20logo%20navbar%20desktop%20not%20scrolled.svg"
            alt="Softcodes Logo"
            className="h-8 w-auto mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-white mb-2">
            Join Softcodes
          </h1>
          <p className="text-gray-300">
            Start coding faster with AI assistance
          </p>
          {plan && (
            <div className="mt-4 px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-lg">
              <p className="text-blue-300 text-sm">
                Selected plan: <span className="font-semibold capitalize">{plan}</span>
                {billing && <span className="ml-2">({billing})</span>}
                {currency && <span className="ml-2">- {currency}</span>}
                {seats && seats !== '1' && <span className="ml-2">- {seats} seats</span>}
              </p>
            </div>
          )}
        </div>
        
        <ClerkSignUp
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: '#3b82f6',
              colorBackground: 'rgba(15, 23, 42, 0.8)',
              colorInputBackground: 'rgba(30, 41, 59, 0.5)',
              colorInputText: '#ffffff',
              colorText: '#ffffff',
              colorTextSecondary: '#94a3b8',
              borderRadius: '0.5rem',
            },
            elements: {
              card: 'bg-slate-800/50 backdrop-blur-lg border border-white/10 shadow-2xl',
              headerTitle: 'text-white',
              headerSubtitle: 'text-gray-300',
              socialButtonsBlockButton: 'border border-white/20 hover:bg-white/10 text-white',
              formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
              footerActionLink: 'text-blue-400 hover:text-blue-300',
            },
          }}
          fallbackRedirectUrl={dynamicRedirectUrl}
          signInUrl="/sign-in"
        />
      </div>
    </div>
  );
};

export default SignUp;