import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

interface UseRedirectAfterAuthOptions {
  defaultRedirect?: string;
  preserveQuery?: boolean;
}

export const useRedirectAfterAuth = (
  options: UseRedirectAfterAuthOptions = {}
) => {
  const { defaultRedirect = '/dashboard', preserveQuery = false } = options;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      const redirectUrl = searchParams.get('redirect_url');
      
      if (redirectUrl) {
        // Redirect to the intended page
        navigate(decodeURIComponent(redirectUrl));
      } else {
        // Redirect to default page
        const queryString = preserveQuery ? `?${searchParams.toString()}` : '';
        navigate(`${defaultRedirect}${queryString}`);
      }
    }
  }, [isLoaded, isSignedIn, navigate, searchParams, defaultRedirect, preserveQuery]);
};

export const usePlanSelection = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedPlan = searchParams.get('plan');

  const setSelectedPlan = (plan: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('plan', plan);
    navigate(`?${newSearchParams.toString()}`, { replace: true });
  };

  const redirectToSignUpWithPlan = (plan: string) => {
    navigate(`/sign-up?plan=${plan}`);
  };

  return {
    selectedPlan,
    setSelectedPlan,
    redirectToSignUpWithPlan,
  };
};