import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKindeAuthContext } from '@/contexts/KindeAuthContext';
import { Loader2 } from 'lucide-react';

const TeamsCallback = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, organization } = useKindeAuthContext();

  useEffect(() => {
    // Wait for authentication to complete
    if (isLoading) return;

    if (isAuthenticated) {
      // Check if this is a new organization that needs subscription setup
      const needsSubscription = !organization; // You might want to check database here
      
      if (needsSubscription) {
        // Redirect to subscription setup
        navigate('/teams/subscribe');
      } else {
        // Redirect to teams dashboard
        navigate('/teams/dashboard');
      }
    } else {
      // If not authenticated, redirect back to login
      navigate('/teams/login');
    }
  }, [isAuthenticated, isLoading, organization, navigate]);

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
        <p className="text-white text-lg mb-2">Completing sign in...</p>
        <p className="text-white/50 text-sm">You'll be redirected shortly.</p>
      </div>
    </div>
  );
};

export default TeamsCallback;