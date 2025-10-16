import { getStripe, getPriceConfig, calculateTotalAmount, getPriceId } from './client';
import { StripeCheckoutData, StripeCheckoutDataWithCurrency, CurrencyCode } from '@/types/database';
import { createMultiCurrencyStripeCheckoutSession, mockCreateMultiCurrencyCheckoutSession } from '@/api/stripe';

const API_BASE = import.meta.env.VITE_API_URL || ''; // set VITE_API_URL in your .env for external API or leave empty to use relative paths (same domain)

// Multi-currency checkout session creation
export const createMultiCurrencyCheckoutSession = async (checkoutData: StripeCheckoutDataWithCurrency) => {
  try {
    // Use mock implementation only if explicitly requested (for testing)
    if (import.meta.env.VITE_USE_STRIPE_MOCK === 'true') {
      console.log('Using Stripe mock implementation (VITE_USE_STRIPE_MOCK=true)');
      return await mockCreateMultiCurrencyCheckoutSession(checkoutData);
    }

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

// Legacy checkout session creation for backward compatibility
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
    } else if (sessionId) {
      // Use Stripe.js redirect for sessions without direct URL (e.g., mock sessions)
      return await redirectToCheckout(sessionId);
    } else {
      throw new Error('No checkout URL or session ID received');
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

// Multi-currency checkout data preparation
export const prepareMultiCurrencyCheckoutData = (
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  currency: CurrencyCode,
  clerkUserId: string,
  seats: number = 1
): StripeCheckoutDataWithCurrency => {
  const priceId = getPriceId(planType, billingFrequency, currency);
  const baseUrl = window.location.origin;

  return {
    planType,
    billingFrequency,
    currency,
    priceId,
    seats,
    clerkUserId,
    successUrl: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/payment/cancelled`,
  };
};

// Legacy helper function for backward compatibility
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

// Multi-currency checkout data validation
export const validateMultiCurrencyCheckoutData = (data: StripeCheckoutDataWithCurrency): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.planType || !['pro', 'teams'].includes(data.planType)) {
    errors.push('Invalid plan type');
  }

  if (!data.billingFrequency || !['monthly', 'yearly'].includes(data.billingFrequency)) {
    errors.push('Invalid billing frequency');
  }

  if (!data.currency || !['EUR', 'USD', 'GBP'].includes(data.currency)) {
    errors.push('Invalid currency');
  }

  if (!data.priceId || data.priceId.trim() === '') {
    errors.push('Price ID is required');
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

// Legacy validation function for backward compatibility
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

// Multi-currency pricing display
export const getMultiCurrencyPricingDisplay = (
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  currency: CurrencyCode,
  seats: number = 1
) => {
  const priceConfig = getPriceConfig(planType, billingFrequency, currency);
  const totalAmount = calculateTotalAmount(planType, billingFrequency, currency, seats);
  
  const perSeatPrice = priceConfig.amount / 100;
  const totalPrice = totalAmount / 100;
  
  const period = billingFrequency === 'monthly' ? 'month' : 'year';
  const currencySymbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  
  if (planType === 'teams' && seats > 1) {
    return {
      perSeat: `${currencySymbol}${perSeatPrice}/${period}`,
      total: `${currencySymbol}${totalPrice}/${period}`,
      description: `${seats} seats × ${currencySymbol}${perSeatPrice}/${period}`,
      savings: billingFrequency === 'yearly' ? '20% off' : null,
    };
  }
  
  return {
    perSeat: `${currencySymbol}${perSeatPrice}/${period}`,
    total: `${currencySymbol}${totalPrice}/${period}`,
    description: `${currencySymbol}${totalPrice}/${period}`,
    savings: billingFrequency === 'yearly' ? '20% off' : null,
  };
};

// Legacy pricing display for backward compatibility
export const getPricingDisplay = (
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  seats: number = 1
) => {
  const priceConfig = getPriceConfig(planType, billingFrequency, 'USD');
  const totalAmount = calculateTotalAmount(planType, billingFrequency, 'USD', seats);
  
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