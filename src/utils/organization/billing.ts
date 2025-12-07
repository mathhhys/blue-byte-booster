import { OrganizationBillingInfo, CreateOrganizationSubscriptionRequest } from '@/types/organization';

// Mock API functions for organization billing
// In production, these would call your actual backend endpoints

export const getOrganizationSubscription = async (orgId: string, token?: string) => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${API_BASE}/api/organizations/subscription?orgId=${orgId}`, {
      method: 'GET',
      headers,
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
  request: CreateOrganizationSubscriptionRequest,
  token?: string
): Promise<{ success: boolean; checkout_url?: string; error?: string }> => {
  try {
    console.log('Creating organization subscription with request:', request);
    
    const payload = {
      ...request,
      priceId: 'price_1SaINqH6gWxKcaTXAKZ5CoWW', // Use the real Stripe price ID
    };
    
    console.log('Sending payload to API:', payload);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${API_BASE}/api/organizations/create-subscription`, {
      method: 'POST',
      headers,
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
  orgId: string,
  token?: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    console.log('🔍 Frontend: Creating billing portal for org:', orgId, 'token present:', !!token);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const API_BASE = import.meta.env.VITE_API_URL || '';
    const url = `${API_BASE}/api/organizations/create-billing-portal`;
    console.log('🔍 Frontend request:', { url, hasAuth: !!token });

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        clerk_org_id: orgId
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Billing portal response error:', response.status, data);
      throw new Error(data.error || 'Failed to create billing portal');
    }

    console.log('✅ Billing portal success:', data.url);
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
  try {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${API_BASE}/api/organizations/seats/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        org_id: orgId,
        clerk_user_id: userId,
        email: userEmail,
        name: userName
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to assign seat'
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Error assigning seat to member:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign seat'
    };
  }
};

export const removeSeatFromMember = async (
  orgId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${API_BASE}/api/organizations/seats/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        org_id: orgId
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to remove seat'
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Error removing seat from member:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove seat'
    };
  }
};

export const updateSubscriptionQuantity = async (
  orgId: string,
  quantity: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${API_BASE}/api/organizations/subscription/quantity`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        org_id: orgId,
        quantity: quantity
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to update subscription quantity'
      };
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('Error updating subscription quantity:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update subscription quantity'
    };
  }
};

export const formatSeatUsage = (used: number, total: number): string => {
  return `${used}/${total} seats used`;
};

export const calculateSeatCost = (
  planType: 'teams',
  billingFrequency: 'monthly' | 'yearly',
  seats: number
): number => {
  const basePrice = billingFrequency === 'monthly' ? 40 : 32;
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

// Organization credit pool functions
export const getOrgCredits = async (orgId: string, token?: string) => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${API_BASE}/api/organizations/credits?org_id=${orgId}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch organization credits');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching organization credits:', error);
    throw error;
  }
};

export const createOrgCreditTopup = async (
  orgId: string,
  creditsAmount: number,
  token?: string
): Promise<{ success: boolean; checkout_url?: string; error?: string }> => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const API_BASE = import.meta.env.VITE_API_URL || '';
    const response = await fetch(`${API_BASE}/api/organizations/credits/topup`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        org_id: orgId,
        credits_amount: creditsAmount
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create top-up session');
    }

    const data = await response.json();
    return {
      success: true,
      checkout_url: data.checkout_url,
    };
  } catch (error) {
    console.error('Error creating org credit top-up:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create top-up session'
    };
  }
};

export const formatOrgCreditUsage = (used: number, total: number): string => {
  return `${used}/${total} credits used`;
};