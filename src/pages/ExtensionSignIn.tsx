import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const ExtensionSignIn: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Get redirect URI from query params or use default
    const redirectUri = searchParams.get('redirect_uri') || 
                       searchParams.get('vscode_redirect_uri') || 
                       'vscode-softcodes://auth/callback';
    
    // Redirect to the proper VSCode authentication initiation page
    const authUrl = `/auth/vscode-initiate?vscode_redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    // Small delay to show loading state
    setTimeout(() => {
      navigate(authUrl);
    }, 500);
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="text-center text-white">
        <Spinner className="w-10 h-10 mb-4" />
        <h2 className="text-xl font-semibold mb-2">VSCode Extension Authentication</h2>
        <p className="text-gray-400">Redirecting to sign-in...</p>
      </div>
    </div>
  );
};

export default ExtensionSignIn;