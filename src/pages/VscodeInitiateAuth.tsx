import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner'; // Assuming a spinner component exists
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Assuming an alert component exists

export const VscodeInitiateAuth: React.FC = () => {
  const [searchParams] = useSearchParams();
  const vscodeRedirectUri = searchParams.get('vscode_redirect_uri');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initiateAuthFlow = async () => {
      if (!vscodeRedirectUri) {
        setError('Missing VSCode redirect URI parameter.');
        return;
      }

      try {
        // Call backend to initiate PKCE flow and get Clerk redirect URL
        const response = await fetch(`/api/auth/initiate-vscode-auth?redirect_uri=${encodeURIComponent(vscodeRedirectUri)}`);
        const data = await response.json();

        if (data.success && data.auth_url) {
          // Redirect to Clerk's sign-in/sign-up page via the backend-provided URL
          window.location.href = data.auth_url;
        } else {
          setError(data.error || 'Failed to initiate authentication flow.');
        }
      } catch (err) {
        console.error('Error initiating VSCode auth:', err);
        setError('Network error or server issue during authentication initiation.');
      }
    };

    initiateAuthFlow();
  }, [vscodeRedirectUri]);

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
        <p>Initiating VSCode authentication...</p>
      </div>
    </div>
  );
};