import { supabase } from './client';
import { createClient } from '@supabase/supabase-js';

// Create server-side client with service role key for database operations
const serverSupabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Debug logging for validation
console.log('🔧 Database client configuration:');
console.log('- Using server-side client with service role key');
console.log('- URL:', process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL);
console.log('- Service role key configured:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

// Types for database operations
export interface User {
  id: string;
  clerk_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  plan_type: 'starter' | 'pro' | 'teams' | 'enterprise';
  credits: number;
  stripe_customer_id?: string;
  vscode_session_id?: string;
  last_vscode_login?: string;
  vscode_client_version?: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id?: string;
  plan_type: 'pro' | 'teams' | 'enterprise';
  billing_frequency: 'monthly' | 'yearly';
  seats: number;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  current_period_start?: string;
  current_period_end?: string;
  created_at: string;
  updated_at: string;
}

export interface TeamInvitation {
  id: string;
  subscription_id: string;
  inviter_id: string;
  clerk_invitation_id?: string;
  email: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: 'grant' | 'usage' | 'refund' | 'bonus';
  description?: string;
  reference_id?: string;
  created_at: string;
}

// User operations
export const userOperations = {
  // Create or update user from Clerk data
  async upsertUser(userData: {
    clerk_id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
    plan_type?: 'starter' | 'pro' | 'teams' | 'enterprise';
  }): Promise<{ data: User | null; error: any }> {
    try {
      const { data, error } = await serverSupabase.rpc('upsert_user', {
        p_clerk_id: userData.clerk_id,
        p_email: userData.email,
        p_first_name: userData.first_name || null,
        p_last_name: userData.last_name || null,
        p_avatar_url: userData.avatar_url || null,
        p_plan_type: userData.plan_type || 'starter'
      });

      if (error) throw error;

      // Fetch the complete user record using clerk_id to respect RLS policy
      const { data: user, error: fetchError } = await serverSupabase
        .from('users')
        .select('*')
        .eq('clerk_id', userData.clerk_id)
        .single();

      return { data: user, error: fetchError };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get user by Clerk ID
  async getUserByClerkId(clerkId: string): Promise<{ data: User | null; error: any }> {
    try {
      console.log('🔍 Searching for user with Clerk ID:', clerkId);
      console.log('🔧 Using serverSupabase client with service role (bypasses RLS)');
      
      const { data, error } = await serverSupabase
        .from('users')
        .select('*')
        .eq('clerk_id', clerkId)
        .single(); // Use .single() instead of .limit(1)

      console.log('📊 Database query result:', { data, error });
      
      if (error && error.code !== 'PGRST116') {
        console.error('❌ Unexpected database error:', error);
      }

      if (error) {
        // If no rows found, Supabase .single() returns an error with code 'PGRST116'
        // We treat this as no user found, not a critical error
        if (error.code === 'PGRST116') {
          console.log('⚠️ No user found with Clerk ID:', clerkId);
          return { data: null, error: null };
        }
        console.error('❌ Database query error:', error);
        return { data: null, error };
      }

      if (data) {
        console.log('✅ Found user:', data);
        return { data: data, error: null };
      } else {
        console.log('⚠️ No user found with Clerk ID:', clerkId);
        return { data: null, error: null };
      }
    } catch (error) {
      console.error('❌ Exception in getUserByClerkId:', error);
      return { data: null, error };
    }
  },

  // Update user plan
  async updateUserPlan(clerkId: string, planType: string): Promise<{ data: User | null; error: any }> {
    try {
      const { data, error } = await serverSupabase
        .from('users')
        .update({ plan_type: planType, updated_at: new Date().toISOString() })
        .eq('clerk_id', clerkId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update Stripe customer ID
  async updateStripeCustomerId(clerkId: string, stripeCustomerId: string): Promise<{ data: User | null; error: any }> {
    try {
      const { data, error } = await serverSupabase
        .from('users')
        .update({ stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() })
        .eq('clerk_id', clerkId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }
};

// Credit operations
export const creditOperations = {
  // Grant credits to user
  async grantCredits(
    clerkId: string, 
    amount: number, 
    description: string = 'Credits granted',
    referenceId?: string
  ): Promise<{ success: boolean; error?: any }> {
    try {
      const { data, error } = await serverSupabase.rpc('grant_credits', {
        p_clerk_id: clerkId,
        p_amount: amount,
        p_description: description,
        p_reference_id: referenceId || null
      });

      return { success: data === true, error };
    } catch (error) {
      return { success: false, error };
    }
  },

  // Deduct credits from user
  async deductCredits(
    clerkId: string, 
    amount: number, 
    description: string = 'Credits used',
    referenceId?: string
  ): Promise<{ success: boolean; error?: any }> {
    try {
      const { data, error } = await serverSupabase.rpc('deduct_credits', {
        p_clerk_id: clerkId,
        p_amount: amount,
        p_description: description,
        p_reference_id: referenceId || null
      });

      return { success: data === true, error };
    } catch (error) {
      return { success: false, error };
    }
  },

  // Get credit history
  async getCreditHistory(clerkId: string): Promise<{ data: CreditTransaction[] | null; error: any }> {
    try {
      // First get user ID
      const { data: user } = await userOperations.getUserByClerkId(clerkId);
      if (!user) return { data: null, error: 'User not found' };

      const { data, error } = await serverSupabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }
};

// Subscription operations
export const subscriptionOperations = {
  // Create subscription
  async createSubscription(subscriptionData: {
    user_id: string;
    stripe_subscription_id?: string;
    plan_type: 'pro' | 'teams' | 'enterprise';
    billing_frequency: 'monthly' | 'yearly';
    seats?: number;
    current_period_start?: string;
    current_period_end?: string;
  }): Promise<{ data: Subscription | null; error: any }> {
    try {
      const { data, error } = await serverSupabase
        .from('subscriptions')
        .insert({
          ...subscriptionData,
          seats: subscriptionData.seats || 1
        })
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get user subscriptions
  async getUserSubscriptions(clerkId: string): Promise<{ data: Subscription[] | null; error: any }> {
    try {
      // First get user ID
      const { data: user } = await userOperations.getUserByClerkId(clerkId);
      if (!user) return { data: null, error: 'User not found' };

      const { data, error } = await serverSupabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update subscription status
  async updateSubscriptionStatus(
    stripeSubscriptionId: string, 
    status: 'active' | 'canceled' | 'past_due' | 'incomplete'
  ): Promise<{ data: Subscription | null; error: any }> {
    try {
      const { data, error } = await serverSupabase
        .from('subscriptions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', stripeSubscriptionId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }
};

// Team invitation operations
export const teamInvitationOperations = {
  // Create team invitation
  async createInvitation(invitationData: {
    subscription_id: string;
    inviter_id: string;
    email: string;
    clerk_invitation_id?: string;
  }): Promise<{ data: TeamInvitation | null; error: any }> {
    try {
      const { data, error } = await serverSupabase
        .from('team_invitations')
        .insert(invitationData)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get invitations for subscription
  async getSubscriptionInvitations(subscriptionId: string): Promise<{ data: TeamInvitation[] | null; error: any }> {
    try {
      const { data, error } = await serverSupabase
        .from('team_invitations')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Update invitation status
  async updateInvitationStatus(
    invitationId: string, 
    status: 'pending' | 'accepted' | 'expired' | 'revoked'
  ): Promise<{ data: TeamInvitation | null; error: any }> {
    try {
      const { data, error } = await serverSupabase
        .from('team_invitations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', invitationId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get invitations by email
  async getInvitationsByEmail(email: string): Promise<{ data: TeamInvitation[] | null; error: any }> {
    try {
      const { data, error } = await serverSupabase
        .from('team_invitations')
        .select('*')
        .eq('email', email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }
};

// Helper functions
export const databaseHelpers = {
  // Initialize user after Clerk authentication
  async initializeUser(clerkUser: {
    id: string;
    emailAddresses: Array<{ emailAddress: string }>;
    firstName?: string | null;
    lastName?: string | null;
  }, planType: 'starter' | 'pro' | 'teams' = 'starter'): Promise<{ user: User | null; error?: any }> {
    try {
      const { data: user, error } = await userOperations.upsertUser({
        clerk_id: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        first_name: clerkUser.firstName || undefined,
        last_name: clerkUser.lastName || undefined,
        plan_type: planType
      });

      if (error) throw error;

      // Note: Starter plan users get 25 credits by default from the database schema
      // No additional credits need to be granted here

      return { user, error: null };
    } catch (error) {
      return { user: null, error };
    }
  },

  // Process successful payment
  async processSuccessfulPayment(
    clerkId: string,
    planType: 'pro' | 'teams',
    stripeSubscriptionId: string,
    billingFrequency: 'monthly' | 'yearly',
    seats: number = 1
  ): Promise<{ success: boolean; error?: any }> {
    try {
      // Get user
      const { data: user } = await userOperations.getUserByClerkId(clerkId);
      if (!user) throw new Error('User not found');

      // Update user plan
      await userOperations.updateUserPlan(clerkId, planType);

      // Create subscription record
      await subscriptionOperations.createSubscription({
        user_id: user.id,
        stripe_subscription_id: stripeSubscriptionId,
        plan_type: planType,
        billing_frequency: billingFrequency,
        seats
      });

      // Grant credits based on plan and seats
      const creditsPerSeat = 500;
      const totalCredits = creditsPerSeat * seats;
      
      await creditOperations.grantCredits(
        clerkId,
        totalCredits,
        `${planType.charAt(0).toUpperCase() + planType.slice(1)} plan credits (${seats} seat${seats > 1 ? 's' : ''})`,
        stripeSubscriptionId
      );

      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }
};