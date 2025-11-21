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
  const scriptLoaded = useRef(false);

  // Load script once
  useEffect(() => {
    if (scriptLoaded.current) return;

    const script = document.createElement('script');
    script.src = 'https://www.redditstatic.com/ads/pixel.js';
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      scriptLoaded.current = true;
      // Initialize after script loads
      initializePixel();
    };

    script.onerror = () => {
      console.error('Failed to load Reddit Pixel script');
    };
  }, []);

  const initializePixel = () => {
    if (initialized.current || !window.rdt) return;

    const pixelId = 'a2_i17xl31pbg9k';

    if (isLoaded && user) {
      const email = user.primaryEmailAddress?.emailAddress;
      const advancedMatching = {
        email: email,
        externalId: user.id,
      };
      window.rdt('init', pixelId, advancedMatching);
      console.log('Reddit Pixel initialized with advanced matching');
    } else {
      window.rdt('init', pixelId);
      console.log('Reddit Pixel initialized (basic)');
    }

    initialized.current = true;

    // Track initial PageVisit
    if (window.rdt) {
      window.rdt('track', 'PageVisit');
    }
  };

  // Re-init or identify if user becomes available after initial load
  useEffect(() => {
    if (scriptLoaded.current && isLoaded && user && !initialized.current) {
      initializePixel();
    }
  }, [isLoaded, user]);

  // Track PageVisit on route changes
  useEffect(() => {
    if (window.rdt && initialized.current && location.pathname) {
      window.rdt('track', 'PageVisit');
    }
  }, [location.pathname]);

  return null;
};

export default RedditPixelTracker;