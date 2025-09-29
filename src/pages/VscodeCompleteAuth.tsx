import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const VscodeCompleteAuth: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const vscodeRedirectUri = searchParams.get('vscode_redirect_uri');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const completeAuthFlow = async () => {
      if (!code || !state || !vscodeRedirectUri) {
        setError('Missing required parameters: code, state, or vscode_redirect_uri.');
        return;
      }

      try {
        console.log('VSCode Complete Auth: Received code and state, redirecting to extension URI');
        // Redirect to the VSCode extension's custom URI scheme with the authorization code and state
        const callbackUrl = `${vscodeRedirectUri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
        console.log('Redirecting to:', callbackUrl);
        window.location.href = callbackUrl;
      } catch (err) {
        console.error('Error completing VSCode auth redirect:', err);
        setError('Failed to redirect to VSCode extension.');
      }
    };

    completeAuthFlow();
  }, [code, state, vscodeRedirectUri]);

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
        <p>Completing VSCode authentication...</p>
      </div>
    </div>
  );
};