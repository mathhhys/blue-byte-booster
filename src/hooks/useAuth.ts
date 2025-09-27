import { useUser, useAuth as useClerkAuth, useOrganization } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { organizationSeatOperations } from '@/utils/supabase/database';
import { useEffect, useState } from 'react';

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

// Hook for seat enforcement in organization contexts
export const useSeatEnforcement = () => {
  const { user } = useUser();
  const { organization } = useOrganization();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [hasActiveSeat, setHasActiveSeat] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSeatAccess = async () => {
      if (!organization?.id || !user?.id) {
        setHasActiveSeat(null);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await organizationSeatOperations.getActiveSeatForUser(
          organization.id,
          user.id
        );

        if (error) {
          console.error('Error checking seat access:', error);
          setHasActiveSeat(false);
        } else {
          setHasActiveSeat(data?.hasActiveSeat || false);
        }
      } catch (error) {
        console.error('Exception in seat check:', error);
        setHasActiveSeat(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkSeatAccess();
  }, [organization?.id, user?.id]);

  // Function to enforce seat requirement and redirect if needed
  const enforceSeatRequirement = (redirectPath: string = '/organizations') => {
    if (hasActiveSeat === false && !isLoading) {
      toast({
        title: "Seat Required",
        description: "You need an active seat to access this feature. Please contact your organization admin.",
        variant: "destructive",
      });
      navigate(redirectPath);
      return false;
    }
    return true;
  };

  return {
    hasActiveSeat,
    isLoading,
    enforceSeatRequirement,
  };
};