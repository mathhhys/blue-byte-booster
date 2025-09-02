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
        return;
      }

      if (!isSignedIn || !user) {
        setError('You must be signed in to complete VSCode authentication. Redirecting to sign-in...');
        setTimeout(() => {
          const currentUrl = window.location.pathname + window.location.search;
          navigate(`/sign-in?redirect_url=${encodeURIComponent(currentUrl)}`);
        }, 3000);
        return;
      }

      const state = searchParams.get('state');
      const vscodeRedirectUri = searchParams.get('vscode_redirect_uri');

      if (!state || !vscodeRedirectUri) {
        setError('Missing required parameters for VSCode callback.');
        return;
      }

      setStatus('Generating authorization code...');

      try {
        // Generate a proper authorization code
        const authCode = btoa(`${user.id}:${state}:${Date.now()}`).replace(/=/g, '');
        
        // Update the OAuth record with the authorization code and Clerk user ID
        const response = await fetch('/api/auth/update-auth-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            state, 
            clerk_user_id: user.id,
            authorization_code: authCode 
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update authentication code.');
        }

        const data = await response.json();
        const finalAuthCode = data.authorization_code || authCode;

        setStatus('Redirecting to VSCode...');

        // Redirect back to VSCode with the proper authorization code
        const finalVscodeRedirect = new URL(decodeURIComponent(vscodeRedirectUri));
        finalVscodeRedirect.searchParams.set('code', finalAuthCode);
        finalVscodeRedirect.searchParams.set('state', state);

        // Add a small delay to ensure the UI updates
        setTimeout(() => {
          window.location.href = finalVscodeRedirect.toString();
        }, 500);

      } catch (err) {
        console.error('Error processing VSCode auth callback:', err);
        setError(`Authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    handleCallback();
  }, [isLoaded, isSignedIn, user, searchParams]);

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
        <p className="text-sm text-gray-400 mt-2">Please wait while we complete the authentication...</p>
      </div>
    </div>
  );
};