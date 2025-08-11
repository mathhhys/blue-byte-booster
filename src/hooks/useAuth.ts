import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

export const useAuth = () => {
  const { user, isLoaded } = useUser();
  const { isSignedIn, signOut } = useClerkAuth();
  const navigate = useNavigate();

  const redirectToSignIn = (redirectUrl?: string) => {
    const url = redirectUrl ? `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}` : '/sign-in';
    navigate(url);
  };

  const redirectToSignUp = (plan?: string) => {
    const url = plan ? `/sign-up?plan=${plan}` : '/sign-up';
    navigate(url);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return {
    user,
    isLoaded,
    isSignedIn,
    signOut: handleSignOut,
    redirectToSignIn,
    redirectToSignUp,
  };
};