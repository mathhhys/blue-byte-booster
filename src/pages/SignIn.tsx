import { SignIn as ClerkSignIn } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { useEffect } from 'react';
import { setAuthPageMeta } from '@/utils/seo';

const SignIn = () => {
  useEffect(() => {
    setAuthPageMeta('signIn');
  }, []);
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
            Welcome Back
          </h1>
          <p className="text-gray-300">
            Sign in to continue coding with AI
          </p>
        </div>
        
        <ClerkSignIn 
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
          redirectUrl="/dashboard"
          signUpUrl="/sign-up"
        />
      </div>
    </div>
  );
};

export default SignIn;