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
          navigate(`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        }, 3000);
        return;
      }

      const state = searchParams.get('state');
      const vscodeRedirectUri = searchParams.get('vscode_redirect_uri');

      if (!state || !vscodeRedirectUri) {
        setError('Missing required parameters for VSCode callback.');
        return;
      }

      setStatus('Completing authentication handshake...');

      try {
        const response = await fetch('/api/auth/update-auth-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ state, clerk_user_id: user.id }),
        });

        if (!response.ok) {
          throw new Error('Failed to update authentication code.');
        }

        const authorizationCode = user.id;
        const finalVscodeRedirect = new URL(decodeURIComponent(vscodeRedirectUri));
        finalVscodeRedirect.searchParams.set('code', authorizationCode);
        finalVscodeRedirect.searchParams.set('state', state);

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