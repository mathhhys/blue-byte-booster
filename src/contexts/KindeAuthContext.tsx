import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import {
  KindeProvider,
  useKindeAuth
} from '@kinde-oss/kinde-auth-react';

// Kinde configuration from environment variables
const KINDE_CLIENT_ID = import.meta.env.VITE_KINDE_CLIENT_ID;
const KINDE_DOMAIN = import.meta.env.VITE_KINDE_DOMAIN;
const KINDE_REDIRECT_URI = import.meta.env.VITE_KINDE_REDIRECT_URI || `${window.location.origin}/teams/callback`;
const KINDE_LOGOUT_URI = import.meta.env.VITE_KINDE_LOGOUT_URI || `${window.location.origin}/teams`;

interface KindeOrganization {
  orgCode: string;
  orgName?: string;
}

interface KindeAuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any;
  organization: KindeOrganization | null;
  getToken: () => Promise<string | null>;
  login: (options?: { org_code?: string }) => void;
  logout: () => void;
  register: (options?: { org_code?: string }) => void;
  createOrganization: () => void;
}

const KindeAuthContext = createContext<KindeAuthContextType | null>(null);

export const useKindeAuthContext = () => {
  const context = useContext(KindeAuthContext);
  if (!context) {
    throw new Error('useKindeAuthContext must be used within a KindeAuthProvider');
  }
  return context;
};

interface KindeAuthProviderWrapperProps {
  children: ReactNode;
}

const KindeAuthProviderInner: React.FC<{ children: ReactNode }> = ({ children }) => {
  const kindeAuth = useKindeAuth();
  const {
    isAuthenticated,
    isLoading,
    user,
    getToken,
    login,
    logout,
    register,
    getClaim,
  } = kindeAuth;

  const [organization, setOrganization] = useState<KindeOrganization | null>(null);

  // Get current organization from JWT claims
  useEffect(() => {
    const loadOrganization = async () => {
      if (!isAuthenticated || !getClaim) {
        setOrganization(null);
        return;
      }
      
      try {
        // Kinde stores org info in JWT claims
        const orgCodeClaim = await getClaim('org_code');
        const orgNameClaim = await getClaim('org_name');
        
        if (orgCodeClaim?.value) {
          setOrganization({
            orgCode: String(orgCodeClaim.value),
            orgName: orgNameClaim?.value ? String(orgNameClaim.value) : undefined,
          });
        } else {
          setOrganization(null);
        }
      } catch {
        setOrganization(null);
      }
    };
    
    loadOrganization();
  }, [isAuthenticated, getClaim]);

  const value: KindeAuthContextType = {
    isAuthenticated: isAuthenticated || false,
    isLoading: isLoading || false,
    user,
    organization,
    getToken: async () => {
      try {
        const token = await getToken?.();
        return token || null;
      } catch {
        return null;
      }
    },
    login: (options) => login?.(options ? { orgCode: options.org_code } : undefined),
    logout: () => logout?.(),
    register: (options) => register?.(options ? { orgCode: options.org_code } : undefined),
    createOrganization: () => {
      // Redirect to Kinde organization creation
      // This will be handled by Kinde's hosted UI
      login?.({ isCreateOrg: true });
    },
  };

  return (
    <KindeAuthContext.Provider value={value}>
      {children}
    </KindeAuthContext.Provider>
  );
};

export const KindeAuthProviderWrapper: React.FC<KindeAuthProviderWrapperProps> = ({ children }) => {
  // Check if Kinde is configured
  if (!KINDE_CLIENT_ID || !KINDE_DOMAIN) {
    console.warn('Kinde configuration missing. Please set VITE_KINDE_CLIENT_ID and VITE_KINDE_DOMAIN.');
    // Return a fallback context to prevent errors
    return (
      <KindeAuthContext.Provider value={{
        isAuthenticated: false,
        isLoading: false,
        user: null,
        organization: null,
        getToken: async () => null,
        login: () => console.warn('Kinde not configured'),
        logout: () => console.warn('Kinde not configured'),
        register: () => console.warn('Kinde not configured'),
        createOrganization: () => console.warn('Kinde not configured'),
      }}>
        {children}
      </KindeAuthContext.Provider>
    );
  }

  return (
    <KindeProvider
      clientId={KINDE_CLIENT_ID}
      domain={KINDE_DOMAIN}
      redirectUri={KINDE_REDIRECT_URI}
      logoutUri={KINDE_LOGOUT_URI}
    >
      <KindeAuthProviderInner>
        {children}
      </KindeAuthProviderInner>
    </KindeProvider>
  );
};

export default KindeAuthProviderWrapper;