import { CreateOrganization as ClerkCreateOrganization } from '@clerk/clerk-react';
import { useSearchParams } from 'react-router-dom';
import { dark } from '@clerk/themes';
import { useEffect, useMemo } from 'react';
import { setAuthPageMeta } from '@/utils/seo';

const CreateOrganization = () => {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan');
  const billing = searchParams.get('billing');
  const currency = searchParams.get('currency');
  const seats = searchParams.get('seats');
  const redirectUrl = searchParams.get('redirect_url');

  useEffect(() => {
    setAuthPageMeta('createOrganization');
  }, []);

  // Build the redirect URL to go back to post-signup
  const dynamicRedirectUrl = useMemo(() => {
    const params = new URLSearchParams();
    
    if (plan) params.set('plan', plan);
    if (billing) params.set('billing', billing);
    if (currency) params.set('currency', currency);
    if (seats) params.set('seats', seats);
    if (redirectUrl) params.set('original_redirect', redirectUrl);
    
    return `/auth/post-signup?${params.toString()}`;
  }, [plan, billing, currency, seats, redirectUrl]);
  
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
            Create Your Organization
          </h1>
          <p className="text-gray-300">
            Set up your team to continue to checkout
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
        
        <div className="flex justify-center">
          <ClerkCreateOrganization
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
                formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
              },
            }}
            afterCreateOrganizationUrl={dynamicRedirectUrl}
            skipInvitationScreen={true}
          />
        </div>
      </div>
    </div>
  );
};

export default CreateOrganization;