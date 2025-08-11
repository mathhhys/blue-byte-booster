// Using any for User type since Clerk's User type is not directly exportable
// In practice, you can access user properties through the useUser hook
export interface AuthUser {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  emailAddresses: Array<{
    emailAddress: string;
    id: string;
  }>;
  imageUrl?: string;
  planType?: string;
  credits?: number;
  lastLoginAt?: string;
}

export interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AuthUser | null;
}

export interface PlanType {
  id: 'starter' | 'pro' | 'teams' | 'enterprise';
  name: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: string[];
}

export interface UserStats {
  totalRequests: number;
  remainingCredits: number;
  planType: string;
  nextBillingDate: string;
  usageThisMonth: number;
}

export interface Activity {
  id: string;
  type: 'login' | 'request' | 'upgrade' | 'setting_change';
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredRole?: string;
  redirectTo?: string;
}

export interface AuthButtonProps {
  variant: 'sign-in' | 'sign-up' | 'get-started';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  plan?: string;
  redirectUrl?: string;
}

export interface UserMenuProps {
  user: AuthUser;
  variant: 'desktop' | 'mobile';
}