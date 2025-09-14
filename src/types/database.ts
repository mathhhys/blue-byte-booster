// Database types for TypeScript support
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          clerk_id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          plan_type: 'starter' | 'pro' | 'teams' | 'enterprise';
          credits: number;
          stripe_customer_id: string | null;
          vscode_session_id: string | null;
          last_vscode_login: string | null;
          vscode_client_version: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clerk_id: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          plan_type?: 'starter' | 'pro' | 'teams' | 'enterprise';
          credits?: number;
          stripe_customer_id?: string | null;
          vscode_session_id?: string | null;
          last_vscode_login?: string | null;
          vscode_client_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clerk_id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          plan_type?: 'starter' | 'pro' | 'teams' | 'enterprise';
          credits?: number;
          stripe_customer_id?: string | null;
          vscode_session_id?: string | null;
          last_vscode_login?: string | null;
          vscode_client_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_subscription_id: string | null;
          plan_type: 'pro' | 'teams' | 'enterprise';
          billing_frequency: 'monthly' | 'yearly';
          seats: number;
          status: 'active' | 'canceled' | 'past_due' | 'incomplete';
          current_period_start: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_subscription_id?: string | null;
          plan_type: 'pro' | 'teams' | 'enterprise';
          billing_frequency: 'monthly' | 'yearly';
          seats?: number;
          status?: 'active' | 'canceled' | 'past_due' | 'incomplete';
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_subscription_id?: string | null;
          plan_type?: 'pro' | 'teams' | 'enterprise';
          billing_frequency?: 'monthly' | 'yearly';
          seats?: number;
          status?: 'active' | 'canceled' | 'past_due' | 'incomplete';
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      team_invitations: {
        Row: {
          id: string;
          subscription_id: string;
          inviter_id: string;
          clerk_invitation_id: string | null;
          email: string;
          status: 'pending' | 'accepted' | 'expired' | 'revoked';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subscription_id: string;
          inviter_id: string;
          clerk_invitation_id?: string | null;
          email: string;
          status?: 'pending' | 'accepted' | 'expired' | 'revoked';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          subscription_id?: string;
          inviter_id?: string;
          clerk_invitation_id?: string | null;
          email?: string;
          status?: 'pending' | 'accepted' | 'expired' | 'revoked';
          created_at?: string;
          updated_at?: string;
        };
      };
      credit_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          transaction_type: 'grant' | 'usage' | 'refund' | 'bonus';
          description: string | null;
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          transaction_type: 'grant' | 'usage' | 'refund' | 'bonus';
          description?: string | null;
          reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          transaction_type?: 'grant' | 'usage' | 'refund' | 'bonus';
          description?: string | null;
          reference_id?: string | null;
          created_at?: string;
        };
      };
    };
    Functions: {
      grant_credits: {
        Args: {
          p_clerk_id: string;
          p_amount: number;
          p_description?: string;
          p_reference_id?: string;
        };
        Returns: boolean;
      };
      deduct_credits: {
        Args: {
          p_clerk_id: string;
          p_amount: number;
          p_description?: string;
          p_reference_id?: string;
        };
        Returns: boolean;
      };
      upsert_user: {
        Args: {
          p_clerk_id: string;
          p_email: string;
          p_first_name?: string;
          p_last_name?: string;
          p_plan_type?: string;
        };
        Returns: string;
      };
    };
  };
}

// Plan configuration types
export interface PlanConfig {
  id: 'pro' | 'teams' | 'enterprise';
  name: string;
  description: string;
  price: {
    monthly: number | null;
    yearly: number | null;
  };
  features: string[];
  credits?: number;
  maxSeats?: number;
  isPopular?: boolean;
  isContactSales?: boolean;
}

// Stripe-related types
export interface StripeCheckoutData {
  planType: 'pro' | 'teams' | 'enterprise';
  billingFrequency: 'monthly' | 'yearly';
  seats?: number;
  clerkUserId: string;
  successUrl: string;
  cancelUrl: string;
}

// Authentication flow types
export interface AuthFlowState {
  isOpen: boolean;
  selectedPlan?: 'pro' | 'teams' | 'enterprise';
  billingFrequency: 'monthly' | 'yearly';
  seats: number;
  isLoading: boolean;
  error?: string;
}

// Team invitation types
export interface InvitationData {
  email: string;
  subscriptionId: string;
  inviterId: string;
}

export interface InvitationResult {
  success: boolean;
  invitationId?: string;
  clerkInvitationId?: string;
  error?: string;
}