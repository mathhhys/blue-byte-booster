// API functions for Stripe operations
// Note: In a production app, these would call your actual backend API

import { StripeCheckoutData, StripeCheckoutDataWithCurrency, CurrencyCode } from '@/types/database';
import { STRIPE_PRODUCTS, STRIPE_PRODUCTS_MULTI_CURRENCY, getPriceConfig } from '@/utils/stripe/client';

// API base URL - use environment variable or fallback to relative paths for local dev
const API_BASE_URL = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV ? '' : 'https://api.softcodes.ai'
);

// Create multi-currency Stripe checkout session
export const createMultiCurrencyStripeCheckoutSession = async (checkoutData: StripeCheckoutDataWithCurrency) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stripe/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkoutData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to create checkout session');
    }

    const data = await response.json();
    return {
      success: true,
      sessionId: data.sessionId,
      url: data.url,
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

// Legacy create Stripe checkout session
export const createStripeCheckoutSession = async (checkoutData: StripeCheckoutData) => {
  try {
    // In a real implementation, this would call your backend
    // For now, we'll simulate the API call
    
    const response = await fetch(`${API_BASE_URL}/api/stripe/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authorization header if needed
        // 'Authorization': `Bearer ${await getAuthToken()}`,
      },
      body: JSON.stringify(checkoutData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to create checkout session');
    }

    const data = await response.json();
    return {
      success: true,
      sessionId: data.sessionId,
      url: data.url,
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

// Create Stripe customer portal session
export const createStripeCustomerPortalSession = async (clerkUserId: string) => {
  try {
    console.log('=== STRIPE API DEBUG START ===');
    console.log('API_BASE_URL:', API_BASE_URL);
    console.log('Development mode:', import.meta.env.DEV);
    console.log('Full URL:', `${API_BASE_URL}/api/stripe/create-customer-portal-session`);
    console.log('Request payload:', { userId: clerkUserId });
    
    // In development mode with no API_BASE_URL, use mock implementation
    if (import.meta.env.DEV && !API_BASE_URL) {
      console.log('Using development mock for billing portal');
      console.log('=== STRIPE API DEBUG END (MOCK) ===');
      return mockCreateBillingPortalSession(clerkUserId);
    }
    
    const response = await fetch(`${API_BASE_URL}/api/stripe/create-customer-portal-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: clerkUserId }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    console.log('Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Error response text:', errorText);
      
      let errorData: any = {};
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        console.log('Failed to parse error as JSON:', e);
      }
      
      console.log('=== STRIPE API DEBUG END (ERROR) ===');
      throw new Error(errorData.error || `HTTP ${response.status}: ${errorText || 'Failed to create customer portal session'}`);
    }

    const data = await response.json();
    console.log('Success response data:', data);
    console.log('=== STRIPE API DEBUG END (SUCCESS) ===');
    
    return {
      success: true,
      url: data.url,
    };
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    console.log('Error type:', error.constructor.name);
    console.log('Is network error:', error instanceof TypeError);
    
    // Fallback to mock in development if network fails
    if (import.meta.env.DEV && error instanceof TypeError) {
      console.log('Network error in development, falling back to mock');
      console.log('=== STRIPE API DEBUG END (FALLBACK TO MOCK) ===');
      return mockCreateBillingPortalSession(clerkUserId);
    }
    
    console.log('=== STRIPE API DEBUG END (EXCEPTION) ===');
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

// Mock implementation for development
const mockCreateBillingPortalSession = async (clerkUserId: string) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('Mock billing portal session created for user:', clerkUserId);
  
  // For development, we'll show an alert instead of redirecting
  return {
    success: true,
    url: null, // We'll handle this differently in the dashboard
    mock: true,
  };
};

// Get checkout session status
export const getStripeSessionStatus = async (sessionId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stripe/session-status?session_id=${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // If API endpoint doesn't exist, fall back to mock for development
      console.warn('Stripe session status API endpoint not available, using mock implementation');
      return await mockGetSessionStatus(sessionId);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting session status, falling back to mock:', error);
    // Fall back to mock implementation for development
    return await mockGetSessionStatus(sessionId);
  }
};

// Process payment success via backend API
export const processPaymentSuccess = async (sessionId: string, clerkUserId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stripe/process-payment-success`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        clerkUserId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to process payment');
    }

    return await response.json();
  } catch (error) {
    console.error('Error processing payment success:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

// Store mock session data temporarily (in a real app, this would be in your database)
const mockSessionStore = new Map();

// Mock session status for development
export const mockGetSessionStatus = async (sessionId: string) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Extract plan info from session ID if it's a mock session
  if (sessionId.startsWith('cs_mock_')) {
    // Try to get stored session data, or use defaults
    const storedData = mockSessionStore.get(sessionId);
    const planType = storedData?.planType || 'pro';
    const billingFrequency = storedData?.billingFrequency || 'monthly';
    const currency = storedData?.currency || 'EUR';
    const seats = storedData?.seats || 1;
    
    // Calculate amount based on plan and currency
    let amount;
    if (storedData?.amount) {
      amount = storedData.amount;
    } else {
      // Fallback to legacy calculation
      const priceConfig = STRIPE_PRODUCTS[planType][billingFrequency];
      amount = priceConfig.amount * seats;
    }

    return {
      success: true,
      data: {
        status: 'complete',
        payment_status: 'paid',
        amount_total: amount,
        currency: currency.toLowerCase(),
        customer_email: 'user@example.com',
        subscription_id: `sub_mock_${Date.now()}`,
        metadata: {
          planType,
          billingFrequency,
          currency,
          seats: seats.toString(),
          priceId: storedData?.priceId || '',
        },
      },
    };
  }

  return {
    success: false,
    error: 'Session not found',
  };
};

// Multi-currency mock implementation for development/testing
export const mockCreateMultiCurrencyCheckoutSession = async (checkoutData: StripeCheckoutDataWithCurrency) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    // Validate the checkout data
    if (!checkoutData.planType || !['pro', 'teams', 'enterprise'].includes(checkoutData.planType)) {
      throw new Error('Invalid plan type');
    }

    if (!checkoutData.billingFrequency || !['monthly', 'yearly'].includes(checkoutData.billingFrequency)) {
      throw new Error('Invalid billing frequency');
    }

    if (!checkoutData.currency || !['EUR', 'USD', 'GBP'].includes(checkoutData.currency)) {
      throw new Error('Invalid currency');
    }

    if (!checkoutData.clerkUserId) {
      throw new Error('User ID is required');
    }

    // Enterprise plans should not reach this point as they are contact sales
    if (checkoutData.planType === 'enterprise') {
      throw new Error('Enterprise plans require direct contact with sales');
    }

    // Get price configuration using multi-currency pricing
    const priceConfig = getPriceConfig(checkoutData.planType, checkoutData.billingFrequency, checkoutData.currency);
    const totalAmount = priceConfig.amount * (checkoutData.seats || 1);

    // Mock session data
    const mockSessionId = `cs_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session data for later retrieval
    mockSessionStore.set(mockSessionId, {
      planType: checkoutData.planType,
      billingFrequency: checkoutData.billingFrequency,
      currency: checkoutData.currency,
      seats: checkoutData.seats,
      amount: totalAmount,
      priceId: checkoutData.priceId,
    });

    return {
      success: true,
      sessionId: mockSessionId,
      url: null, // Don't provide a URL, let the checkout handler manage the redirect
      metadata: {
        planType: checkoutData.planType,
        billingFrequency: checkoutData.billingFrequency,
        currency: checkoutData.currency,
        seats: checkoutData.seats,
        amount: totalAmount,
        priceId: checkoutData.priceId,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

// Legacy mock implementation for development/testing
export const mockCreateCheckoutSession = async (checkoutData: StripeCheckoutData) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    // Validate the checkout data
    if (!checkoutData.planType || !['pro', 'teams'].includes(checkoutData.planType)) {
      throw new Error('Invalid plan type');
    }

    if (!checkoutData.billingFrequency || !['monthly', 'yearly'].includes(checkoutData.billingFrequency)) {
      throw new Error('Invalid billing frequency');
    }

    if (!checkoutData.clerkUserId) {
      throw new Error('User ID is required');
    }

    // Get price configuration
    const priceConfig = STRIPE_PRODUCTS[checkoutData.planType][checkoutData.billingFrequency];
    const totalAmount = priceConfig.amount * (checkoutData.seats || 1);

    // In a real implementation, you would:
    // 1. Create a Stripe customer if one doesn't exist
    // 2. Create a Stripe checkout session
    // 3. Store session metadata in your database
    // 4. Return the session ID and URL

    // Mock session data
    const mockSessionId = `cs_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session data for later retrieval
    mockSessionStore.set(mockSessionId, {
      planType: checkoutData.planType,
      billingFrequency: checkoutData.billingFrequency,
      seats: checkoutData.seats,
      amount: totalAmount,
    });

    return {
      success: true,
      sessionId: mockSessionId,
      url: null, // Don't provide a URL, let the checkout handler manage the redirect
      metadata: {
        planType: checkoutData.planType,
        billingFrequency: checkoutData.billingFrequency,
        seats: checkoutData.seats,
        amount: totalAmount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

// Helper function to get auth token (implement based on your auth system)
const getAuthToken = async (): Promise<string> => {
  // This would typically get the token from Clerk or your auth system
  // For now, return empty string
  return '';
};

// Webhook signature verification (for backend use)
export const verifyStripeWebhook = (payload: string, signature: string, secret: string): boolean => {
  // This would be implemented on your backend using Stripe's webhook verification
  // stripe.webhooks.constructEvent(payload, signature, secret)
  return true;
};

// Process webhook events (for backend use)
export const processStripeWebhook = async (event: any) => {
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    throw error;
  }
};

// Webhook event handlers (for backend use)
const handleCheckoutSessionCompleted = async (session: any) => {
  // Extract metadata from session
  const { customer, subscription, metadata } = session;
  
  // Update user's subscription status in database
  // Grant credits based on plan
  // Send confirmation email
  
  console.log('Checkout session completed:', session.id);
};

const handlePaymentSucceeded = async (invoice: any) => {
  // Handle successful recurring payment
  // Grant additional credits if needed
  // Update subscription status
  
  console.log('Payment succeeded:', invoice.id);
};

const handlePaymentFailed = async (invoice: any) => {
  // Handle failed payment
  // Notify user
  // Update subscription status
  
  console.log('Payment failed:', invoice.id);
};

const handleSubscriptionUpdated = async (subscription: any) => {
  // Handle subscription changes (plan upgrades, downgrades, etc.)
  // Update user's plan in database
  // Adjust credits accordingly
  
  console.log('Subscription updated:', subscription.id);
};

const handleSubscriptionDeleted = async (subscription: any) => {
  // Handle subscription cancellation
  // Update user's plan to free tier
  // Send cancellation confirmation
  
  console.log('Subscription deleted:', subscription.id);
};