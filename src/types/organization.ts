export interface OrganizationSubscription {
  id: string;
  clerk_org_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan_type: 'teams';
  billing_frequency: 'monthly' | 'yearly';
  seats_total: number;
  seats_used: number;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete';
  current_period_start: Date;
  current_period_end: Date;
  created_at: Date;
  updated_at: Date;
}

export interface OrganizationSeat {
  id: string;
  organization_subscription_id: string;
  clerk_user_id: string;
  clerk_org_id: string;
  user_email: string;
  user_name: string;
  assigned_at: Date;
  assigned_by: string; // admin user_id
}

export interface OrganizationBillingInfo {
  subscription: OrganizationSubscription | null;
  seats: OrganizationSeat[];
  isAdmin: boolean;
  canManageBilling: boolean;
  memberCount: number;
  seatUsage: {
    used: number;
    total: number;
    available: number;
    percentUsed: number;
  };
}

export interface CreateOrganizationSubscriptionRequest {
  clerk_org_id: string;
  plan_type: 'teams';
  billing_frequency: 'monthly' | 'yearly';
  seats_total: number;
}

export interface CreateOrganizationSubscriptionResponse {
  success: boolean;
  subscription?: OrganizationSubscription;
  checkout_url?: string;
  error?: string;
}

export interface AssignSeatRequest {
  clerk_org_id: string;
  clerk_user_id: string;
  user_email: string;
  user_name: string;
}

export interface AssignSeatResponse {
  success: boolean;
  seat?: OrganizationSeat;
  error?: string;
}

export interface OrganizationBillingPortalRequest {
  clerk_org_id: string;
}

export interface OrganizationBillingPortalResponse {
  success: boolean;
  url?: string;
  error?: string;
}