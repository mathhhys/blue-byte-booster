import { loadStripe, Stripe } from '@stripe/stripe-js';
import { CurrencyCode } from '@/types/database';
import { MULTI_CURRENCY_PRICING } from '@/config/pricing';
import { getCurrencyConfig } from '@/config/currencies';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

console.log('Stripe publishable key loaded:', stripePublishableKey ? `pk_${stripePublishableKey.slice(3,10)}...` : 'UNDEFINED - Check .env.local for VITE_STRIPE_PUBLISHABLE_KEY');

if (!stripePublishableKey) {
  throw new Error('Stripe publishable key not set. Add VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... to .env.local');
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
  defaultCurrency: 'eur' as const,
  defaultLocale: 'en' as const,
} as const;

// Legacy STRIPE_PRODUCTS for backward compatibility
export const STRIPE_PRODUCTS = {
  pro: {
    monthly: {
      priceId: 'price_1RvK8KH6gWxKcaTXCWyv035N',
      amount: 2000,
    },
    yearly: {
      priceId: 'price_1RvK8KH6gWxKcaTXEn1S0Lql',
      amount: 19200,
    },
  },
  teams: {
    monthly: {
      priceId: 'price_1RwN7VH6gWxKcaTXHVkwwT60',
      amount: 3000,
    },
    yearly: {
      priceId: 'price_1RwN8hH6gWxKcaTXEaGbVvhz',
      amount: 28800,
    },
  },
} as const;

// Multi-currency product configurations
export const STRIPE_PRODUCTS_MULTI_CURRENCY = MULTI_CURRENCY_PRICING;

// Updated helper function to get price configuration with currency
export const getPriceConfig = (
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  currency: CurrencyCode
) => {
  const planPricing = MULTI_CURRENCY_PRICING[planType][currency];
  return {
    priceId: planPricing.priceIds[billingFrequency],
    amount: planPricing[billingFrequency] * 100, // Convert to cents
  };
};

// Legacy helper function for backward compatibility
export const getPriceConfigLegacy = (
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly'
) => {
  return STRIPE_PRODUCTS[planType][billingFrequency];
};

// Updated helper function to calculate total amount with currency
export const calculateTotalAmount = (
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  currency: CurrencyCode,
  seats: number = 1
): number => {
  const priceConfig = getPriceConfig(planType, billingFrequency, currency);
  return priceConfig.amount * seats;
};

// Legacy helper function for backward compatibility
export const calculateTotalAmountLegacy = (
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  seats: number = 1
): number => {
  const priceConfig = getPriceConfigLegacy(planType, billingFrequency);
  return priceConfig.amount * seats;
};

// Updated helper function to format price with currency
export const formatPriceWithCurrency = (
  amountInCents: number,
  currency: CurrencyCode
): string => {
  const config = getCurrencyConfig(currency);
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: currency,
  }).format(amountInCents / 100);
};

// Legacy helper function for backward compatibility
export const formatPrice = (amountInCents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amountInCents / 100);
};

// Updated helper function to get savings percentage with currency
export const getSavingsPercentage = (
  planType: 'pro' | 'teams',
  currency: CurrencyCode
): number => {
  const pricing = MULTI_CURRENCY_PRICING[planType][currency];
  const monthly = pricing.monthly;
  const yearly = pricing.yearly;
  const yearlyEquivalent = monthly * 12;
  return Math.round(((yearlyEquivalent - yearly) / yearlyEquivalent) * 100);
};

// Legacy helper function for backward compatibility
export const getSavingsPercentageLegacy = (planType: 'pro' | 'teams'): number => {
  const monthly = STRIPE_PRODUCTS[planType].monthly.amount;
  const yearly = STRIPE_PRODUCTS[planType].yearly.amount;
  const yearlyEquivalent = monthly * 12;
  return Math.round(((yearlyEquivalent - yearly) / yearlyEquivalent) * 100);
};

// Helper function to get price ID for specific currency and plan
export const getPriceId = (
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  currency: CurrencyCode
): string => {
  return MULTI_CURRENCY_PRICING[planType][currency].priceIds[billingFrequency];
};

// Helper function to get raw price amount for specific currency
export const getPriceAmount = (
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  currency: CurrencyCode
): number => {
  return MULTI_CURRENCY_PRICING[planType][currency][billingFrequency];
};