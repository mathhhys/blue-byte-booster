import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    rdt: (action: string, ...args: any[]) => void;
  }
}

const RedditPixelTracker = () => {
  const { user, isLoaded } = useUser();
  const location = useLocation();
  const initialized = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    // Check if rdt is available
    if (!window.rdt) {
      console.warn('Reddit Pixel script not loaded');
      return;
    }

    // Initialize Pixel
    // We only want to init once per session ideally, but if user logs in, we might want to re-init or identify.
    // However, standard practice for SPA is to init on load. 
    // Since we delayed init until here, we can do it now.
    
    if (!initialized.current) {
      const pixelId = 'a2_i17xl31pbg9k';
      
      if (user) {
        const email = user.primaryEmailAddress?.emailAddress;
        // Add other fields if available in user object or metadata
        const advancedMatching = {
          email: email,
          // externalId: user.id, // Optional: use Clerk ID as external ID
        };
        
        window.rdt('init', pixelId, advancedMatching);
        console.log('Reddit Pixel initialized with Advanced Matching');
      } else {
        window.rdt('init', pixelId);
        console.log('Reddit Pixel initialized (Standard)');
      }
      
      initialized.current = true;
    }

    // Track PageVisit on route change
    // Note: The App.tsx already has a tracker for PageVisit, but it was using a generic one.
    // We should consolidate. Since we are moving logic here, we should handle tracking here.
    
    window.rdt('track', 'PageVisit');
    
  }, [isLoaded, user, location.pathname]);

  return null;
};

export default RedditPixelTracker;