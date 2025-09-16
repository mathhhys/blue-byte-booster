import { useAuth } from '@clerk/clerk-react';

// Individual user billing utilities
export const createUserBillingPortal = async (
  userId: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    console.log('Creating billing portal for user:', userId);

    const response = await fetch('/api/stripe/create-customer-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId
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
    console.error('Error creating user billing portal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create billing portal'
    };
  }
};

export const getUserSubscription = async (userId: string) => {
  try {
    const response = await fetch(`/api/users/subscription?userId=${userId}`, {
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
    console.error('Error fetching user subscription:', error);

    // Fallback to mock data for development
    return {
      hasSubscription: false,
      subscription: null,
    };
  }
};

export const createUserSubscription = async (
  request: {
    planType: 'pro' | 'teams';
    billingFrequency: 'monthly' | 'yearly';
    seats?: number;
    clerkUserId: string;
    successUrl?: string;
    cancelUrl?: string;
  }
): Promise<{ success: boolean; checkout_url?: string; error?: string }> => {
  try {
    console.log('Creating user subscription with request:', request);

    const payload = {
      planType: request.planType,
      billingFrequency: request.billingFrequency,
      seats: request.seats || 1,
      clerkUserId: request.clerkUserId,
      successUrl: request.successUrl,
      cancelUrl: request.cancelUrl
    };

    console.log('Sending payload to API:', payload);

    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('API response status:', response.status);

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
      checkout_url: data.url,
    };
  } catch (error) {
    console.error('Error creating user subscription:', error);

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