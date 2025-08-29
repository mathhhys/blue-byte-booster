import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const VscodeAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoaded, isSignedIn } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      if (!isLoaded) {
        // Clerk is still loading, wait for it
        return;
      }

      if (!isSignedIn || !user) {
        // User is not signed in, redirect to sign-in page with a message
        setError('You must be signed in to complete VSCode authentication. Redirecting to sign-in...');
        setTimeout(() => {
          navigate(`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        }, 3000);
        return;
      }

      const state = searchParams.get('state');
      const codeChallenge = searchParams.get('code_challenge');
      const vscodeRedirectUri = searchParams.get('vscode_redirect_uri');

      if (!state || !codeChallenge || !vscodeRedirectUri) {
        setError('Missing required parameters for VSCode callback.');
        return;
      }

      setStatus('Completing authentication handshake...');

      try {
        // The backend's /api/auth/token endpoint expects the 'code' to be the Clerk user ID for now.
        // In a more robust OAuth flow, Clerk would provide an authorization code here that the backend would exchange.
        const authorizationCode = user.id; 

        // Construct the final redirect URL for the VSCode extension
        const finalVscodeRedirect = new URL(decodeURIComponent(vscodeRedirectUri));
        finalVscodeRedirect.searchParams.set('code', authorizationCode);
        finalVscodeRedirect.searchParams.set('state', state);

        // Redirect to the VSCode custom URI
        window.location.href = finalVscodeRedirect.toString();

      } catch (err) {
        console.error('Error processing VSCode auth callback:', err);
        setError('An unexpected error occurred during the authentication callback.');
      }
    };

    handleCallback();
  }, [isLoaded, isSignedIn, user, searchParams, navigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <Alert variant="destructive" className="w-full max-w-md">
          <AlertTitle>Authentication Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-center text-white">
        <Spinner className="w-10 h-10 mb-4" />
        <p>{status}</p>
      </div>
    </div>
  );
};