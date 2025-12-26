import { supabase } from './client.js';
import { createClient } from '@supabase/supabase-js';

// Check if we're in a server environment (Node.js/API routes)
const isServerEnvironment = typeof window === 'undefined';

// Get environment variables with proper fallbacks
const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL ||
              process.env.VITE_SUPABASE_URL ||
              process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('🔧 Supabase Server Config Debug:');
  console.log('- Environment:', isServerEnvironment ? 'Server' : 'Browser');
  console.log('- URL available:', !!url);
  console.log('- Service key available:', !!serviceKey);
  console.log('- Service key prefix:', serviceKey ? serviceKey.substring(0, 20) + '...' : 'Not set');
  
  return { url, serviceKey };
};

// Create server-side client with service role key if available
let serverSupabase: any = null;
if (isServerEnvironment) {
  const { url, serviceKey } = getSupabaseConfig();
  
  if (url && serviceKey) {
    console.log('🔧 Creating server-side client with service role key');
    serverSupabase = createClient(url, serviceKey);
  } else {
    console.error('❌ Missing required environment variables for server client:');
    console.error('- SUPABASE_URL or VITE_SUPABASE_URL:', !!url);
    console.error('- SUPABASE_SERVICE_ROLE_KEY:', !!serviceKey);
  }
}

// Helper function to get appropriate client with authentication
export async function getAuthenticatedClient() {
  console.log('🔧 getAuthenticatedClient() called');
  console.log('- isServerEnvironment:', isServerEnvironment);
  console.log('- serverSupabase exists:', !!serverSupabase);
  console.log('- SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('- window exists:', typeof window !== 'undefined');
  
  if (serverSupabase) {
    console.log('🔧 Using server-side client (bypasses RLS)');
    return serverSupabase;
  }
  
  // If we're in server environment but don't have service key, that's an error
  if (isServerEnvironment) {
    console.error('❌ ERROR: Running in server environment but no service role key available!');
    throw new Error('Server environment requires SUPABASE_SERVICE_ROLE_KEY environment variable');
  }
  
  // Browser environment - need to check Clerk authentication
  console.log('🔧 Using browser client - checking authentication');
  console.log('⚠️ WARNING: Browser client requires proper Clerk JWT for RLS');
  console.log('💡 Consider calling API routes instead of direct database operations');
  
  // For now, we'll need to handle this differently
  // The browser client needs proper Clerk JWT token set
  return supabase;
}

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
      const client = await getAuthenticatedClient();
      const { data, error } = await client.rpc('upsert_user', {
        p_clerk_id: userData.clerk_id,
        p_email: userData.email,
        p_first_name: userData.first_name || null,
        p_last_name: userData.last_name || null,
        p_avatar_url: userData.avatar_url || null,
        p_plan_type: userData.plan_type || 'starter'
      });

      if (error) throw error;

      // Fetch the complete user record using clerk_id to respect RLS policy
      const { data: user, error: fetchError } = await client
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
      
      const client = await getAuthenticatedClient();
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('clerk_id', clerkId)
        .single();

      console.log('📊 Database query result:', { data, error });
      
      // Handle RLS error specifically
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('⚠️ No user found with Clerk ID:', clerkId);
          return { data: null, error: null };
        } else if (error.message?.includes('new row violates row-level security') || error.status === 406) {
          console.error('🔒 RLS Policy blocked access. User needs to be authenticated with Clerk.');
          console.log('💡 This operation should be performed server-side or with proper Clerk session.');
          return { data: null, error: 'Authentication required - RLS policy blocking access' };
        }
        console.error('❌ Database query error:', error);
        return { data: null, error };
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
      const client = await getAuthenticatedClient();
      const { data, error } = await client
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
      const client = await getAuthenticatedClient();
      const { data, error } = await client
        .from('users')
        .update({ stripe_customer_id: stripeCustomerId, updated_at: new Date().toISOString() })
        .eq('clerk_id', clerkId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Get organization by Clerk ID
  async getOrganizationByClerkId(clerkOrgId: string): Promise<{ data: any | null; error: any }> {
    try {
      const client = await getAuthenticatedClient();
      const { data, error } = await client
        .from('organizations')
        .select('*')
        .eq('clerk_org_id', clerkOrgId)
        .maybeSingle();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  },

  // Increment invitation count for an organization
  async incrementInvitationCount(clerkOrgId: string): Promise<{ success: boolean; error: any }> {
    try {
      const client = await getAuthenticatedClient();
      const { error } = await client.rpc('increment_invitation_count', {
        p_clerk_org_id: clerkOrgId
      });

      return { success: !error, error };
    } catch (error) {
      return { success: false, error };
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
      const client = await getAuthenticatedClient();
      const { data, error } = await client.rpc('grant_credits', {
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
      const client = await getAuthenticatedClient();
      const { data, error } = await client.rpc('deduct_credits', {
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

      const client = await getAuthenticatedClient();
      const { data, error } = await client
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
      const client = await getAuthenticatedClient();
      const { data, error } = await client
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

      const client = await getAuthenticatedClient();
      const { data, error } = await client
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
      const client = await getAuthenticatedClient();
      const { data, error } = await client
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
      const client = await getAuthenticatedClient();
      const { data, error } = await client
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
      const client = await getAuthenticatedClient();
      const { data, error } = await client
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
      const client = await getAuthenticatedClient();
      const { data, error } = await client
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
      const client = await getAuthenticatedClient();
      const { data, error } = await client
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

// Organization seat operations
export const organizationSeatOperations = {
  // Get seat usage and list for an organization
  async getSeatsForOrganization(clerkOrgId: string): Promise<{
    data: {
      seats_used: number;
      seats_total: number;
      seats: Array<{
        user_id: string | null;
        email: string;
        status: string;
        role: string | null;
        assigned_at: string;
      }>;
    } | null;
    error: any;
  }> {
    try {
      const client = await getAuthenticatedClient();
      
      // Get latest seat-eligible subscription (active OR trialing)
      const { data: subscription, error: subError } = await client
        .from('organization_subscriptions')
        .select('seats_used, seats_total, quantity, overage_seats, status, updated_at')
        .eq('clerk_org_id', clerkOrgId)
        .in('status', ['active', 'trialing'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        console.error('Error fetching subscription:', subError);
        return { data: null, error: subError };
      }

      // Get seats (active + pending) for admin visibility
      const { data: seats, error: seatsError } = await client
        .from('organization_seats')
        .select('clerk_user_id, user_email, status, role, assigned_at')
        .eq('clerk_org_id', clerkOrgId)
        .in('status', ['active', 'pending'])
        .order('assigned_at', { ascending: false });

      if (seatsError) {
        console.error('Error fetching seats:', seatsError);
        return { data: null, error: seatsError };
      }

      const result = {
        seats_used: subscription?.seats_used || 0,
        seats_total: subscription?.seats_total || 0,
        seats: seats?.map(seat => ({
          user_id: seat.clerk_user_id,
          email: seat.user_email,
          status: seat.status,
          role: seat.role,
          assigned_at: seat.assigned_at
        })) || []
      };

      return { data: result, error: null };
    } catch (error) {
      console.error('Error in getSeatsForOrganization:', error);
      return { data: null, error };
    }
  },

  // Assign a seat to a user
  async assignSeat(clerkOrgId: string, userEmail: string, role: string = 'member'): Promise<{
    data: any | null;
    error: any;
  }> {
    try {
      const client = await getAuthenticatedClient();
      
      // Check if user already has an active or pending seat
      const { data: existingSeat, error: existingSeatError } = await client
        .from('organization_seats')
        .select('id, status')
        .eq('clerk_org_id', clerkOrgId)
        .eq('user_email', userEmail)
        .in('status', ['active', 'pending'])
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSeatError) {
        return { data: null, error: existingSeatError };
      }

      if (existingSeat) {
        return { data: null, error: 'User already has a reserved or active seat in this organization' };
      }

      // Get latest seat-eligible subscription (active OR trialing)
      let { data: subscription, error: subError } = await client
        .from('organization_subscriptions')
        .select('id, seats_used, seats_total, overage_seats, status, updated_at')
        .eq('clerk_org_id', clerkOrgId)
        .in('status', ['active', 'trialing'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) {
        return { data: null, error: subError };
      }

      // If no subscription found, try to create a default one (auto-provisioning)
      if (!subscription) {
        console.log('⚠️ No active subscription found, attempting to auto-provision default subscription...');
        
        // First get the organization ID
        const { data: org, error: orgError } = await client
          .from('organizations')
          .select('id')
          .eq('clerk_org_id', clerkOrgId)
          .single();
          
        if (orgError || !org) {
          console.error('Organization not found for auto-provisioning:', orgError);
          return { data: null, error: 'Organization subscription not found' };
        }

        // Create default subscription
        const { data: newSub, error: createError } = await client
          .from('organization_subscriptions')
          .insert({
            organization_id: org.id,
            clerk_org_id: clerkOrgId,
            plan_type: 'teams',
            status: 'trialing',
            seats_total: 5, // Give 5 seats by default for trial
            seats_used: 0
          })
          .select('id, seats_used, seats_total, overage_seats, status, updated_at')
          .single();

        if (createError) {
          console.error('Failed to auto-provision subscription:', createError);
          return { data: null, error: 'Organization subscription not found' };
        }

        subscription = newSub;
        console.log('✅ Auto-provisioned default subscription:', subscription.id);
      }

      // Check seat availability
      if (subscription.seats_used >= subscription.seats_total + subscription.overage_seats) {
        return { data: null, error: 'No available seats. Please upgrade your plan.' };
      }

      const normalizedRole = role === 'admin' ? 'admin' : 'member';

      // Reserve the seat (invite-first semantics): pending until membership is created/accepted
      const { data: seat, error: seatError } = await client
        .from('organization_seats')
        .insert({
          organization_subscription_id: subscription.id,
          clerk_org_id: clerkOrgId,
          clerk_user_id: null, // filled when user becomes a member (webhook)
          user_email: userEmail,
          role: normalizedRole,
          status: 'pending',
          assigned_at: new Date().toISOString()
        })
        .select()
        .single();

      if (seatError) {
        return { data: null, error: seatError };
      }

      // Update seats_used count atomically
      const { error: updateError } = await client.rpc('increment_seats_used', {
        p_subscription_id: subscription.id
      });

      if (updateError) {
        return { data: null, error: updateError };
      }

      return { data: seat, error: null };
    } catch (error) {
      console.error('Error in assignSeat:', error);
      return { data: null, error };
    }
  },

  // Remove/revoke a seat
  async revokeSeat(clerkOrgId: string, clerkUserId: string, reason: string = 'admin_revoked'): Promise<{
    data: any | null;
    error: any;
  }> {
    try {
      const client = await getAuthenticatedClient();
      
      // Find the active seat
      const { data: seat, error: seatError } = await client
        .from('organization_seats')
        .select('id, organization_subscription_id')
        .eq('clerk_org_id', clerkOrgId)
        .eq('clerk_user_id', clerkUserId)
        .eq('status', 'active')
        .single();

      if (seatError || !seat) {
        return { data: null, error: 'Active seat not found for this user' };
      }

      // Revoke the seat
      const { data: revokedSeat, error: revokeError } = await client
        .from('organization_seats')
        .update({
          status: 'revoked',
          revoked_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', seat.id)
        .select()
        .single();

      if (revokeError) {
        return { data: null, error: revokeError };
      }

      // Update seats_used count atomically
      await client.rpc('decrement_seats_used', {
        p_subscription_id: seat.organization_subscription_id
      });

      return { data: revokedSeat, error: null };
    } catch (error) {
      console.error('Error in revokeSeat:', error);
      return { data: null, error };
    }
  },

  // Revoke expired seats (for cron job/edge function)
  async revokeExpiredSeats(): Promise<{
    data: { seats_revoked: number; seats_updated: number } | null;
    error: any;
  }> {
    try {
      const client = await getAuthenticatedClient();
      
      // Find expired seats (expires_at < current time and status is active)
      const { data: expiredSeats, error: fetchError } = await client
        .from('organization_seats')
        .select('id, organization_subscription_id')
        .lt('expires_at', new Date().toISOString())
        .eq('status', 'active');

      if (fetchError) {
        console.error('Error fetching expired seats:', fetchError);
        return { data: null, error: fetchError };
      }

      if (!expiredSeats || expiredSeats.length === 0) {
        return { data: { seats_revoked: 0, seats_updated: 0 }, error: null };
      }

      let seatsUpdated = 0;
      const subscriptionIds = new Set<string>();

      // Update each expired seat
      for (const seat of expiredSeats) {
        const { error: updateError } = await client
          .from('organization_seats')
          .update({
            status: 'expired',
            updated_at: new Date().toISOString()
          })
          .eq('id', seat.id);

        if (updateError) {
          console.error(`Error updating seat ${seat.id}:`, updateError);
          continue;
        }

        seatsUpdated++;
        subscriptionIds.add(seat.organization_subscription_id);
      }

      // Update seat counts for affected subscriptions
      for (const subscriptionId of Array.from(subscriptionIds)) {
        // Get current seat count
        const { data: subscription } = await client
          .from('organization_subscriptions')
          .select('seats_used')
          .eq('id', subscriptionId)
          .single();

        if (subscription) {
          // Count active seats for this subscription
          const { count } = await client
            .from('organization_seats')
            .select('*', { count: 'exact', head: true })
            .eq('organization_subscription_id', subscriptionId)
            .eq('status', 'active');

          const newSeatsUsed = count || 0;
          
          await client
            .from('organization_subscriptions')
            .update({
              seats_used: newSeatsUsed,
              updated_at: new Date().toISOString()
            })
            .eq('id', subscriptionId);
        }
      }

      console.log(`Revoked ${seatsUpdated} expired seats`);
      return { data: { seats_revoked: expiredSeats.length, seats_updated: seatsUpdated }, error: null };
    } catch (error) {
      console.error('Error in revokeExpiredSeats:', error);
      return { data: null, error };
    }
  },

  // Check if a user has an active seat in an organization
  async getActiveSeatForUser(clerkOrgId: string, clerkUserId: string): Promise<{
    data: {
      hasActiveSeat: boolean;
      seatDetails?: {
        id: string;
        role: string | null;
        assigned_at: string;
        expires_at: string | null;
      };
    } | null;
    error: any;
  }> {
    try {
      const client = await getAuthenticatedClient();
      
      const { data: seat, error } = await client
        .from('organization_seats')
        .select('id, role, assigned_at, expires_at')
        .eq('clerk_org_id', clerkOrgId)
        .eq('clerk_user_id', clerkUserId)
        .eq('status', 'active')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No active seat found
          return { data: { hasActiveSeat: false }, error: null };
        }
        return { data: null, error };
      }

      return {
        data: {
          hasActiveSeat: true,
          seatDetails: {
            id: seat.id,
            role: seat.role,
            assigned_at: seat.assigned_at,
            expires_at: seat.expires_at
          }
        },
        error: null
      };
    } catch (error) {
      console.error('Error in getActiveSeatForUser:', error);
      return { data: null, error };
    }
  },

  // Rollback a reserved seat by email (used when Clerk invitation creation fails)
  async releaseSeatByEmail(
    clerkOrgId: string,
    userEmail: string,
    reason: string = 'invite_failed'
  ): Promise<{ data: any | null; error: any }> {
    try {
      const client = await getAuthenticatedClient();

      const { data: seat, error: seatError } = await client
        .from('organization_seats')
        .select('id, organization_subscription_id')
        .eq('clerk_org_id', clerkOrgId)
        .ilike('user_email', userEmail)
        .eq('status', 'pending')
        .is('clerk_user_id', null)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (seatError) {
        return { data: null, error: seatError };
      }

      if (!seat) {
        return { data: null, error: 'Pending seat not found for this email' };
      }

      const { data: revokedSeat, error: revokeError } = await client
        .from('organization_seats')
        .update({
          status: 'revoked',
          revoked_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', seat.id)
        .select()
        .single();

      if (revokeError) {
        return { data: null, error: revokeError };
      }

      // Decrement seats_used atomically
      await client.rpc('decrement_seats_used', {
        p_subscription_id: seat.organization_subscription_id
      });

      return { data: revokedSeat, error: null };
    } catch (error) {
      console.error('Error in releaseSeatByEmail:', error);
      return { data: null, error };
    }
  },

  // Claim an existing reserved seat (pending) on Clerk membership creation.
  // If no reservation exists (e.g. org owner added directly), consume a seat if capacity allows.
  async claimSeatForMembership(params: {
    clerk_org_id: string;
    clerk_user_id: string;
    user_email: string;
    user_name?: string | null;
    role?: string | null;
    assigned_by?: string | null;
  }): Promise<{ data: any | null; error: any }> {
    const {
      clerk_org_id,
      clerk_user_id,
      user_email,
      user_name = null,
      role = null,
      assigned_by = 'system_webhook'
    } = params;

    try {
      const client = await getAuthenticatedClient();

      const normalizedRole = role === 'admin' ? 'admin' : 'member';

      // Get latest seat-eligible subscription
      const { data: subscription, error: subError } = await client
        .from('organization_subscriptions')
        .select('id, seats_used, seats_total, overage_seats, status, updated_at')
        .eq('clerk_org_id', clerk_org_id)
        .in('status', ['active', 'trialing'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError || !subscription) {
        return { data: null, error: 'Organization subscription not found' };
      }

      // If user already has an active seat, return it (idempotent)
      const { data: existingByUser } = await client
        .from('organization_seats')
        .select('id, clerk_user_id, status')
        .eq('clerk_org_id', clerk_org_id)
        .eq('clerk_user_id', clerk_user_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (existingByUser) {
        return { data: existingByUser, error: null };
      }

      // Try to claim a reserved seat by email
      const { data: reservedSeat, error: reservedError } = await client
        .from('organization_seats')
        .select('id, organization_subscription_id')
        .eq('clerk_org_id', clerk_org_id)
        .ilike('user_email', user_email)
        .eq('status', 'pending')
        .is('clerk_user_id', null)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (reservedError) {
        return { data: null, error: reservedError };
      }

      if (reservedSeat) {
        const { data: updatedSeat, error: updateError } = await client
          .from('organization_seats')
          .update({
            clerk_user_id,
            user_name,
            role: normalizedRole,
            status: 'active',
            assigned_by,
            updated_at: new Date().toISOString()
          })
          .eq('id', reservedSeat.id)
          .select()
          .single();

        if (updateError) {
          return { data: null, error: updateError };
        }

        // Do NOT increment seats_used here (it was consumed during reservation)
        return { data: updatedSeat, error: null };
      }

      // No reservation exists - consume a seat if capacity allows
      if (subscription.seats_used >= subscription.seats_total + subscription.overage_seats) {
        return { data: null, error: 'No available seats. Please upgrade your plan.' };
      }

      const { data: seat, error: seatError } = await client
        .from('organization_seats')
        .insert({
          organization_subscription_id: subscription.id,
          clerk_org_id,
          clerk_user_id,
          user_email,
          user_name,
          role: normalizedRole,
          status: 'active',
          assigned_by,
          assigned_at: new Date().toISOString()
        })
        .select()
        .single();

      if (seatError) {
        return { data: null, error: seatError };
      }

      const { error: updateError } = await client.rpc('increment_seats_used', {
        p_subscription_id: subscription.id
      });

      if (updateError) {
        return { data: null, error: updateError };
      }

      return { data: seat, error: null };
    } catch (error) {
      console.error('Error in claimSeatForMembership:', error);
      return { data: null, error };
    }
  }
};

// Organization subscription operations
export const organizationSubscriptionOperations = {
  // Update subscription quantity
  async updateSubscriptionQuantity(clerkOrgId: string, newQuantity: number): Promise<{
    data: any | null;
    error: any;
  }> {
    try {
      const client = await getAuthenticatedClient();
      
      // Get current subscription
      const { data: subscription, error: subError } = await client
        .from('organization_subscriptions')
        .select('id, quantity, seats_total, auto_update_quantity')
        .eq('clerk_org_id', clerkOrgId)
        .eq('status', 'active')
        .maybeSingle();

      if (subError || !subscription) {
        return { data: null, error: 'Active subscription not found' };
      }

      const oldQuantity = subscription.quantity || subscription.seats_total;
      
      // Update quantity
      const { data: updatedSub, error: updateError } = await client
        .from('organization_subscriptions')
        .update({
          quantity: newQuantity,
          seats_total: newQuantity, // Keep in sync for now
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id)
        .select()
        .single();

      if (updateError) {
        return { data: null, error: updateError };
      }

      // Record adjustment
      await client
        .from('seat_adjustments')
        .insert({
          organization_subscription_id: subscription.id,
          old_quantity: oldQuantity,
          new_quantity: newQuantity,
          adjustment_type: newQuantity > oldQuantity ? 'upgrade' : 'downgrade'
        });

      return { data: updatedSub, error: null };
    } catch (error) {
      console.error('Error in updateSubscriptionQuantity:', error);
      return { data: null, error };
    }
  },

  // Deduct credits from an organization's shared pool
  async deductOrgCredits(clerkOrgId: string, amount: number, description: string = 'API Usage'): Promise<{ success: boolean; error?: any }> {
    try {
      const client = await getAuthenticatedClient();
      
      // We use a RPC or a direct update with a check to ensure we don't go below zero
      // For now, let's use a direct update with used_credits increment
      // In a production app, you'd want a Postgres function to handle this atomically
      
      const { data: subscription, error: fetchError } = await client
        .from('organization_subscriptions')
        .select('id, total_credits, used_credits')
        .eq('clerk_org_id', clerkOrgId)
        .in('status', ['active', 'trialing'])
        .single();

      if (fetchError || !subscription) {
        return { success: false, error: 'No active organization subscription found' };
      }

      const remaining = subscription.total_credits - subscription.used_credits;
      if (remaining < amount) {
        return { success: false, error: 'Insufficient organization credits' };
      }

      const { error: updateError } = await client
        .from('organization_subscriptions')
        .update({
          used_credits: subscription.used_credits + amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id);

      if (updateError) throw updateError;

      return { success: true };
    } catch (error) {
      console.error('Error deducting organization credits:', error);
      return { success: false, error };
    }
  }
};