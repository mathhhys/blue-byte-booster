import { OrganizationBillingInfo, CreateOrganizationSubscriptionRequest } from '@/types/organization';

// Mock API functions for organization billing
// In production, these would call your actual backend endpoints

export const getOrganizationSubscription = async (orgId: string) => {
  try {
    const response = await fetch(`/api/organizations/subscription?orgId=${orgId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch subscription data');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching organization subscription:', error);

    // Fallback to mock data for development
    return {
      hasSubscription: false,
      subscription: null,
    };
  }
};

export const createOrganizationSubscription = async (
  request: CreateOrganizationSubscriptionRequest
): Promise<{ success: boolean; checkout_url?: string; error?: string }> => {
  try {
    console.log('Creating organization subscription with request:', request);
    
    const payload = {
      ...request,
      priceId: 'price_1RwNazH6gWxKcaTXi3OmXp4u', // Use the real Stripe price ID
    };
    
    console.log('Sending payload to API:', payload);
    
    const response = await fetch('/api/organizations/create-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clerk_org_id: request.clerk_org_id,
        plan_type: request.plan_type,
        billing_frequency: request.billing_frequency,
        seats_total: request.seats_total
      }),
    });

    console.log('API response status:', response.status);
    console.log('API response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response text:', errorText);
      
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        console.log('Failed to parse error as JSON:', e);
      }
      
      throw new Error(errorData.error || `HTTP ${response.status}: ${errorText || 'Failed to create subscription'}`);
    }

    const data = await response.json();
    console.log('Success response data:', data);
    
    return {
      success: true,
      checkout_url: data.checkout_url,
    };
  } catch (error) {
    console.error('Error creating organization subscription:', error);
    
    // For debugging, let's provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.log('Detailed error info:', {
      message: errorMessage,
      type: error?.constructor?.name,
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    
    return {
      success: false,
      error: `Subscription creation failed: ${errorMessage}`,
    };
  }
};

export const createOrganizationBillingPortal = async (
  orgId: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    console.log('Creating billing portal for organization:', orgId);

    const response = await fetch('/api/organizations/create-billing-portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clerk_org_id: orgId
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create billing portal');
    }

    return {
      success: true,
      url: data.url
    };
  } catch (error) {
    console.error('Error creating organization billing portal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create billing portal'
    };
  }
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