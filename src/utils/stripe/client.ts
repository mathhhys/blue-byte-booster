import { loadStripe, Stripe } from '@stripe/stripe-js';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey) {
  console.warn('Stripe publishable key not found. Please add VITE_STRIPE_PUBLISHABLE_KEY to your environment variables.');
}

// Singleton pattern for Stripe instance
let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(stripePublishableKey || '');
  }
  return stripePromise;
};

// Stripe configuration constants
export const STRIPE_CONFIG = {
  publishableKey: stripePublishableKey,
  currency: 'usd',
  locale: 'en' as const,
} as const;

// Product and price configurations
export const STRIPE_PRODUCTS = {
  pro: {
    monthly: {
      priceId: 'price_1RvKJcH6gWxKcaTXQ4PITKei', // Actual Stripe price ID for Pro Monthly
      amount: 2000, // $20.00 in cents
    },
    yearly: {
      priceId: 'price_1RvKJtH6gWxKcaTXfeLXklqU', // Actual Stripe price ID for Pro Yearly
      amount: 19200, // $192.00 in cents (20% discount)
    },
  },
  teams: {
    monthly: {
      priceId: 'price_teams_monthly', // You'll need to create Teams monthly price in Stripe
      amount: 3000, // $30.00 in cents per seat
    },
    yearly: {
      priceId: 'price_teams_yearly', // You'll need to create Teams yearly price in Stripe
      amount: 28800, // $288.00 in cents per seat (20% discount)
    },
  },
} as const;

// Helper function to get price configuration
export const getPriceConfig = (
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly'
) => {
  return STRIPE_PRODUCTS[planType][billingFrequency];
};

// Helper function to calculate total amount
export const calculateTotalAmount = (
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  seats: number = 1
): number => {
  const priceConfig = getPriceConfig(planType, billingFrequency);
  return priceConfig.amount * seats;
};

// Helper function to format price for display
export const formatPrice = (amountInCents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amountInCents / 100);
};

// Helper function to get savings percentage
export const getSavingsPercentage = (planType: 'pro' | 'teams'): number => {
  const monthly = STRIPE_PRODUCTS[planType].monthly.amount;
  const yearly = STRIPE_PRODUCTS[planType].yearly.amount;
  const yearlyEquivalent = monthly * 12;
  return Math.round(((yearlyEquivalent - yearly) / yearlyEquivalent) * 100);
};