import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, useUser } from '@clerk/clerk-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const ExtensionSignIn: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const state = searchParams.get('state');
  const redirectUri = searchParams.get('redirect_uri');

  useEffect(() => {
    if (!state || !redirectUri) {
      setError('Missing required parameters. Please start the authentication flow from VSCode.');
      return;
    }
  }, [state, redirectUri]);

  useEffect(() => {
    if (user && state && redirectUri && !isProcessing) {
      handleAuthenticationSuccess();
    }
  }, [user, state, redirectUri, isProcessing]);

  const handleAuthenticationSuccess = async () => {
    if (!user || !state || !redirectUri) return;
    
    setIsProcessing(true);
    setError(null);

    try {
      // Update the oauth_codes table with the authenticated user's Clerk ID
      const response = await fetch('/api/auth/complete-vscode-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: state,
          clerk_user_id: user.id,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete authentication');
      }

      const data = await response.json();
      
      if (data.success) {
        // Redirect back to VSCode with success
        const vscodeUrl = `${redirectUri}?code=${user.id}&state=${state}`;
        window.location.href = vscodeUrl;
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError('Failed to complete authentication. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
        <Card className="w-full max-w-md bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-red-400">Authentication Error</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-gray-300 mb-4">
              {error}
            </CardDescription>
            <Button
              variant="outline"
              onClick={() => window.close()}
              className="w-full"
            >
              Close Window
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 p-4">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">VSCode Extension Authentication</CardTitle>
          <CardDescription className="text-gray-400">
            Sign in to connect your VSCode extension
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignedOut>
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                Please sign in to continue with VSCode extension authentication.
              </p>
              <SignInButton mode="modal">
                <Button className="w-full">
                  Sign In
                </Button>
              </SignInButton>
            </div>
          </SignedOut>
          
          <SignedIn>
            <div className="text-center space-y-4">
              {isProcessing ? (
                <>
                  <Spinner className="w-8 h-8 mx-auto" />
                  <p className="text-gray-300">Completing authentication...</p>
                </>
              ) : (
                <>
                  <div className="text-green-400 text-lg">✓</div>
                  <p className="text-gray-300">Authentication successful!</p>
                  <p className="text-gray-400 text-sm">Redirecting to VSCode...</p>
                </>
              )}
            </div>
          </SignedIn>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExtensionSignIn;