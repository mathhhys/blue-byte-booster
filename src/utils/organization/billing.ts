import { OrganizationBillingInfo, CreateOrganizationSubscriptionRequest } from '@/types/organization';

// Mock API functions for organization billing
// In production, these would call your actual backend endpoints

export const getOrganizationBilling = async (orgId: string): Promise<OrganizationBillingInfo> => {
  // Mock implementation for development
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    subscription: {
      id: `sub_${orgId}`,
      clerk_org_id: orgId,
      stripe_customer_id: `cus_${orgId}`,
      stripe_subscription_id: `sub_stripe_${orgId}`,
      plan_type: 'teams',
      billing_frequency: 'monthly',
      seats_total: 10,
      seats_used: 3,
      status: 'active',
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      created_at: new Date(),
      updated_at: new Date(),
    },
    seats: [
      {
        id: 'seat_1',
        organization_subscription_id: `sub_${orgId}`,
        clerk_user_id: 'user_1',
        clerk_org_id: orgId,
        user_email: 'admin@example.com',
        user_name: 'John Admin',
        assigned_at: new Date(),
        assigned_by: 'user_1',
      },
      {
        id: 'seat_2',
        organization_subscription_id: `sub_${orgId}`,
        clerk_user_id: 'user_2',
        clerk_org_id: orgId,
        user_email: 'member@example.com',
        user_name: 'Jane Member',
        assigned_at: new Date(),
        assigned_by: 'user_1',
      },
      {
        id: 'seat_3',
        organization_subscription_id: `sub_${orgId}`,
        clerk_user_id: 'user_3',
        clerk_org_id: orgId,
        user_email: 'developer@example.com',
        user_name: 'Bob Developer',
        assigned_at: new Date(),
        assigned_by: 'user_1',
      },
    ],
    isAdmin: true,
    canManageBilling: true,
    memberCount: 3,
    seatUsage: {
      used: 3,
      total: 10,
      available: 7,
      percentUsed: 30,
    },
  };
};

export const createOrganizationSubscription = async (
  request: CreateOrganizationSubscriptionRequest
): Promise<{ success: boolean; checkout_url?: string; error?: string }> => {
  // Mock implementation
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Simulate success with checkout URL
  return {
    success: true,
    checkout_url: `/organizations?billing=success&mock=true`,
  };
};

export const createOrganizationBillingPortal = async (
  orgId: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  // Mock implementation
  await new Promise(resolve => setTimeout(resolve, 800));

  // In development, show alert instead of redirect
  if (import.meta.env.DEV) {
    return {
      success: true,
      url: null, // Handle in component
    };
  }

  return {
    success: true,
    url: 'https://billing.stripe.com/p/session/test_org_portal',
  };
};

export const assignSeatToMember = async (
  orgId: string,
  userId: string,
  userEmail: string,
  userName: string
): Promise<{ success: boolean; error?: string }> => {
  // Mock implementation
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    success: true,
  };
};

export const removeSeatFromMember = async (
  orgId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  // Mock implementation
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    success: true,
  };
};

export const formatSeatUsage = (used: number, total: number): string => {
  return `${used}/${total} seats used`;
};

export const calculateSeatCost = (
  planType: 'teams',
  billingFrequency: 'monthly' | 'yearly',
  seats: number
): number => {
  const basePrice = billingFrequency === 'monthly' ? 30 : 24;
  return basePrice * seats;
};

export const formatSeatCost = (
  planType: 'teams',
  billingFrequency: 'monthly' | 'yearly',
  seats: number
): string => {
  const cost = calculateSeatCost(planType, billingFrequency, seats);
  const period = billingFrequency === 'monthly' ? 'month' : 'year';
  return `$${cost}/${period}`;
};