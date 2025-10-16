// API functions for Stripe operations
// Note: In a production app, these would call your actual backend API

import { StripeCheckoutData, StripeCheckoutDataWithCurrency, CurrencyCode } from '@/types/database';
import { STRIPE_PRODUCTS, STRIPE_PRODUCTS_MULTI_CURRENCY, getPriceConfig } from '@/utils/stripe/client';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-08-27.basil',
});

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// TypeScript types for billing portal responses
export interface StripeCustomerPortalResponse {
  success: true;
  url: string;
}

export interface StripeCustomerPortalErrorResponse {
  success: false;
  error: string;
}

export interface StripeCustomerPortalMockResponse {
  success: true;
  url: null;
  mock: true;
}

export type StripeCustomerPortalResult =
  | StripeCustomerPortalResponse
  | StripeCustomerPortalErrorResponse
  | StripeCustomerPortalMockResponse;

// API base URL - use relative paths since APIs are now on same domain
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

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
export const createStripeCustomerPortalSession = async (clerkUserId: string): Promise<StripeCustomerPortalResult> => {
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
const mockCreateBillingPortalSession = async (clerkUserId: string): Promise<StripeCustomerPortalMockResponse> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('Mock billing portal session created for user:', clerkUserId);

  // For development, we'll show an alert instead of redirecting
  return {
    success: true as const,
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
  const { customer, subscription, metadata } = session;
  const clerkUserId = metadata.clerkUserId;
  const plan = metadata.plan;
  const skipTrial = metadata.skipTrial === 'true';

  if (!clerkUserId || plan !== 'pro') return;

  try {
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkUserId)
      .single();

    if (!user) return;

    if (skipTrial) {
      // Direct paid: grant full 500 credits
      await supabase.rpc('grant_credits', {
        p_clerk_id: clerkUserId,
        p_amount: 500,
        p_description: 'Pro subscription - full credits',
        p_transaction_type: 'grant',
        p_reference_id: subscription || session.id,
      });

      // Set anniversary date
      await supabase
        .from('users')
        .update({ subscription_anniversary_date: new Date().toISOString() })
        .eq('clerk_id', clerkUserId);
    } else {
      // Trial start: grant 200 trial credits (full grant will happen on conversion)
      await supabase.rpc('grant_credits', {
        p_clerk_id: clerkUserId,
        p_amount: 200,
        p_description: 'Pro trial start - 200 credits',
        p_transaction_type: 'trial_grant',
        p_reference_id: subscription || session.id,
      });
    }

    // Update subscription in database
    await supabase
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        stripe_subscription_id: subscription,
        plan_type: plan,
        billing_frequency: metadata.billingFrequency,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: skipTrial ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days for trial
      });

  } catch (error) {
    console.error('Error handling checkout completion:', error);
  }

  console.log('Checkout session completed:', session.id);
};

const handlePaymentSucceeded = async (invoice: any) => {
  const subscription = invoice.subscription;
  const customer = invoice.customer;

  if (!subscription || !customer) return;

  try {
    // Get customer metadata for clerkUserId
    const stripeCustomer = await stripe.customers.retrieve(customer as string);
    const clerkUserId = (stripeCustomer as any).metadata.clerkUserId;

    if (!clerkUserId) return;

    const { data: user } = await supabase
      .from('users')
      .select('id, plan_type, credits, subscription_anniversary_date')
      .eq('clerk_id', clerkUserId)
      .single();

    if (!user || user.plan_type !== 'pro') return;

    // Check if this is anniversary (monthly reset)
    const anniversary = user.subscription_anniversary_date;
    const now = new Date();
    const isAnniversary = anniversary &&
      now.getFullYear() === new Date(anniversary).getFullYear() &&
      now.getMonth() === new Date(anniversary).getMonth() &&
      now.getDate() === new Date(anniversary).getDate();

    if (isAnniversary) {
      // Monthly reset to 500 credits
      await supabase.rpc('reset_monthly_credits', {
        p_clerk_id: clerkUserId,
        p_plan_credits: 500,
      });
    } else {
      // Regular payment: add credits if needed (for overages or something, but for Pro it's fixed)
      // For Pro, monthly allotment is already handled by reset
    }

    // Update subscription period
    await supabase
      .from('subscriptions')
      .update({
        current_period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : now.toISOString(),
        current_period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
        status: 'active',
      })
      .eq('stripe_subscription_id', subscription);

  } catch (error) {
    console.error('Error handling payment success:', error);
  }

  console.log('Payment succeeded:', invoice.id);
};

const handlePaymentFailed = async (invoice: any) => {
  const subscription = invoice.subscription;
  const customer = invoice.customer;

  if (!subscription || !customer) return;

  try {
    const stripeCustomer = await stripe.customers.retrieve(customer as string);
    const clerkUserId = (stripeCustomer as any).metadata.clerkUserId;

    if (!clerkUserId) return;

    // Update subscription status to past_due
    await supabase
      .from('subscriptions')
      .update({ status: 'past_due' })
      .eq('stripe_subscription_id', subscription);

    // Optionally notify user of failed payment

  } catch (error) {
    console.error('Error handling payment failure:', error);
  }

  console.log('Payment failed:', invoice.id);
};

const handleSubscriptionUpdated = async (subscription: any) => {
  const { id, customer, items, current_period_end, trial_end } = subscription;
  const plan = items.data[0]?.price?.metadata?.plan || 'pro'; // Assume Pro

  try {
    const stripeCustomer = await stripe.customers.retrieve(customer as string);
    const clerkUserId = (stripeCustomer as any).metadata.clerkUserId;

    if (!clerkUserId) return;

    const { data: user } = await supabase
      .from('users')
      .select('id, plan_type, credits, subscription_anniversary_date')
      .eq('clerk_id', clerkUserId)
      .single();

    if (!user) return;

    // Check if trial ended (conversion)
    if (trial_end && !subscription.trial_end) {
      // Trial conversion: grant 300 bonus to reach 500
      const currentCredits = user.credits || 0;
      const bonus = 300;
      const total = 500;

      if (currentCredits < 200) {
        // If less than trial credits, reset to full
        await supabase.rpc('grant_credits', {
          p_clerk_id: clerkUserId,
          p_amount: total,
          p_description: 'Pro trial conversion - full 500 credits',
          p_transaction_type: 'grant',
          p_reference_id: id,
        });
      } else {
        // Add bonus
        await supabase.rpc('grant_credits', {
          p_clerk_id: clerkUserId,
          p_amount: bonus,
          p_description: 'Pro trial conversion - 300 bonus credits',
          p_transaction_type: 'conversion_bonus',
          p_reference_id: id,
        });
      }

      // Set anniversary if not set
      if (!user.subscription_anniversary_date) {
        await supabase
          .from('users')
          .update({ subscription_anniversary_date: new Date().toISOString() })
          .eq('clerk_id', clerkUserId);
      }
    }

    // Update subscription
    await supabase
      .from('subscriptions')
      .upsert({
        stripe_subscription_id: id,
        user_id: user.id,
        plan_type: plan,
        status: subscription.status,
        current_period_end: current_period_end ? new Date(current_period_end * 1000).toISOString() : null,
      });

  } catch (error) {
    console.error('Error handling subscription update:', error);
  }

  console.log('Subscription updated:', id);
};

const handleSubscriptionDeleted = async (subscription: any) => {
  const { id, customer } = subscription;

  try {
    const stripeCustomer = await stripe.customers.retrieve(customer as string);
    const clerkUserId = (stripeCustomer as any).metadata.clerkUserId;

    if (!clerkUserId) return;

    // Update user plan to starter and reset credits if needed
    await supabase
      .from('users')
      .update({ plan_type: 'starter' })
      .eq('clerk_id', clerkUserId);

    await supabase
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('stripe_subscription_id', id);

    // Optionally refund remaining credits or handle cancellation logic

  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }

  console.log('Subscription deleted:', id);
};