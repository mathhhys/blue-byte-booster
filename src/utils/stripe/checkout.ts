import { getStripe, getPriceConfig, calculateTotalAmount } from './client';
import { StripeCheckoutData } from '@/types/database';

const API_BASE = import.meta.env.VITE_API_URL || ''; // set VITE_API_URL in your .env (e.g. http://localhost:3001) or leave empty to use relative paths

// Checkout session creation using backend API
export const createCheckoutSession = async (checkoutData: StripeCheckoutData) => {
  try {
    // Call backend API to create checkout session
    const response = await fetch(`${API_BASE}/api/stripe/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkoutData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create checkout session');
    }

    const { sessionId, url } = await response.json();
    
    if (url) {
      // Redirect to Stripe Checkout
      window.location.href = url;
      return { success: true, sessionId };
    } else {
      throw new Error('No checkout URL received');
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Redirect to Stripe Checkout using Stripe.js
export const redirectToCheckout = async (sessionId: string) => {
  try {
    const stripe = await getStripe();
    
    if (!stripe) {
      throw new Error('Stripe failed to load');
    }

    const { error } = await stripe.redirectToCheckout({ sessionId });
    
    if (error) {
      throw error;
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error redirecting to checkout:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

// Helper function to prepare checkout data
export const prepareCheckoutData = (
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  clerkUserId: string,
  seats: number = 1
): StripeCheckoutData => {
  const baseUrl = window.location.origin;
  
  return {
    planType,
    billingFrequency,
    seats,
    clerkUserId,
    successUrl: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/payment/cancelled`,
  };
};

// Validate checkout data
export const validateCheckoutData = (data: StripeCheckoutData): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.planType || !['pro', 'teams'].includes(data.planType)) {
    errors.push('Invalid plan type');
  }

  if (!data.billingFrequency || !['monthly', 'yearly'].includes(data.billingFrequency)) {
    errors.push('Invalid billing frequency');
  }

  if (!data.clerkUserId || data.clerkUserId.trim() === '') {
    errors.push('User ID is required');
  }

  if (data.planType === 'teams' && (!data.seats || data.seats < 1 || data.seats > 100)) {
    errors.push('Teams plan requires 1-100 seats');
  }

  if (!data.successUrl || !data.cancelUrl) {
    errors.push('Success and cancel URLs are required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Get checkout session status
export const getCheckoutSessionStatus = async (sessionId: string) => {
  try {
    const response = await fetch(`/api/stripe/session-status?session_id=${sessionId}`);
    
    if (!response.ok) {
      throw new Error('Failed to get session status');
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting session status:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

// Calculate and format pricing display
export const getPricingDisplay = (
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  seats: number = 1
) => {
  const priceConfig = getPriceConfig(planType, billingFrequency);
  const totalAmount = calculateTotalAmount(planType, billingFrequency, seats);
  
  const perSeatPrice = priceConfig.amount / 100;
  const totalPrice = totalAmount / 100;
  
  const period = billingFrequency === 'monthly' ? 'month' : 'year';
  
  if (planType === 'teams' && seats > 1) {
    return {
      perSeat: `$${perSeatPrice}/${period}`,
      total: `$${totalPrice}/${period}`,
      description: `${seats} seats × $${perSeatPrice}/${period}`,
      savings: billingFrequency === 'yearly' ? '20% off' : null,
    };
  }
  
  return {
    perSeat: `$${perSeatPrice}/${period}`,
    total: `$${totalPrice}/${period}`,
    description: `$${totalPrice}/${period}`,
    savings: billingFrequency === 'yearly' ? '20% off' : null,
  };
};