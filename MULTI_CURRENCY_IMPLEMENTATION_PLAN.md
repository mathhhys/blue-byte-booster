# Multi-Currency Pricing Implementation Plan

## Implementation Overview
This document provides detailed specifications for implementing multi-currency pricing (EUR, USD, GBP) with a currency toggle selector featuring flag icons.

## Phase 1: Type Definitions and Core Infrastructure

### 1.1 Currency Types (src/types/database.ts)
Add the following types to the existing database.ts file:

```typescript
// Currency-related types
export type CurrencyCode = 'EUR' | 'USD' | 'GBP';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  flag: string;
  locale: string;
  isDefault?: boolean;
}

export interface CurrencyPrice {
  monthly: number;
  yearly: number;
  priceIds: {
    monthly: string;
    yearly: string;
  };
}

export interface MultiCurrencyPrice {
  EUR: CurrencyPrice;
  USD: CurrencyPrice;
  GBP: CurrencyPrice;
}

// Updated PlanConfig to support multi-currency
export interface MultiCurrencyPlanConfig {
  id: 'pro' | 'teams' | 'enterprise';
  name: string;
  description: string;
  pricing: MultiCurrencyPrice;
  features: string[];
  credits?: number;
  maxSeats?: number;
  isPopular?: boolean;
  isContactSales?: boolean;
}

// Extended checkout data to include currency
export interface StripeCheckoutDataWithCurrency extends StripeCheckoutData {
  currency: CurrencyCode;
  priceId: string;
}
```

### 1.2 Currency Configuration (src/config/currencies.ts)
Create new file with currency definitions:

```typescript
import { CurrencyConfig, CurrencyCode } from '@/types/database';

export const SUPPORTED_CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  EUR: {
    code: 'EUR',
    symbol: '€',
    flag: '🇪🇺',
    locale: 'de-DE',
    isDefault: true
  },
  USD: {
    code: 'USD',
    symbol: '$',
    flag: '🇺🇸',
    locale: 'en-US'
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    flag: '🇬🇧',
    locale: 'en-GB'
  }
};

export const DEFAULT_CURRENCY: CurrencyCode = 'EUR';

export const getCurrencyConfig = (code: CurrencyCode): CurrencyConfig => {
  return SUPPORTED_CURRENCIES[code];
};

export const getAllCurrencies = (): CurrencyConfig[] => {
  return Object.values(SUPPORTED_CURRENCIES);
};
```

### 1.3 Pricing Data Configuration (src/config/pricing.ts)
Create comprehensive pricing matrix:

```typescript
import { MultiCurrencyPrice } from '@/types/database';

export const MULTI_CURRENCY_PRICING: Record<'pro' | 'teams', MultiCurrencyPrice> = {
  pro: {
    EUR: {
      monthly: 20,
      yearly: 192,
      priceIds: {
        monthly: 'price_1RvK8KH6gWxKcaTXCWyv035N',
        yearly: 'price_1RvK8LH6gWxKcaTXqqNXiuus'
      }
    },
    USD: {
      monthly: 20,
      yearly: 192,
      priceIds: {
        monthly: 'price_1RvK8KH6gWxKcaTXCWyv035N',
        yearly: 'price_1RvK8KH6gWxKcaTXEn1S0Lql'
      }
    },
    GBP: {
      monthly: 16,
      yearly: 150,
      priceIds: {
        monthly: 'price_1RvK8KH6gWxKcaTXQvGGVCNI',
        yearly: 'price_1RvK8KH6gWxKcaTXYTeJ18no'
      }
    }
  },
  teams: {
    EUR: {
      monthly: 30,
      yearly: 288,
      priceIds: {
        monthly: 'price_1RwN6oH6gWxKcaTXgmKllDYt',
        yearly: 'price_1RwN8QH6gWxKcaTX7thDBBm7'
      }
    },
    USD: {
      monthly: 30,
      yearly: 288,
      priceIds: {
        monthly: 'price_1RwN7VH6gWxKcaTXHVkwwT60',
        yearly: 'price_1RwN8hH6gWxKcaTXEaGbVvhz'
      }
    },
    GBP: {
      monthly: 24,
      yearly: 225,
      priceIds: {
        monthly: 'price_1RwN7uH6gWxKcaTX0jJCR7uU',
        yearly: 'price_1RwN9FH6gWxKcaTXQBUURC9T'
      }
    }
  }
};
```

## Phase 2: Utility Functions and Hooks

### 2.1 Currency Utilities (src/utils/currency.ts)
Create currency formatting and utility functions:

```typescript
import { CurrencyCode, CurrencyConfig } from '@/types/database';
import { SUPPORTED_CURRENCIES } from '@/config/currencies';

export const formatPrice = (
  amount: number,
  currency: CurrencyCode
): string => {
  const config = SUPPORTED_CURRENCIES[currency];
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const getCurrencySymbol = (currency: CurrencyCode): string => {
  return SUPPORTED_CURRENCIES[currency].symbol;
};

export const getCurrencyFlag = (currency: CurrencyCode): string => {
  return SUPPORTED_CURRENCIES[currency].flag;
};

export const getPriceDisplayText = (
  amount: number,
  currency: CurrencyCode,
  period: 'monthly' | 'yearly'
): string => {
  const formattedPrice = formatPrice(amount, currency);
  const periodText = period === 'monthly' ? '/mo' : '/yr';
  return `${formattedPrice}${periodText}`;
};
```

### 2.2 Currency State Hook (src/hooks/useCurrency.ts)
Create currency management hook:

```typescript
import { useState, useCallback, useEffect } from 'react';
import { CurrencyCode } from '@/types/database';
import { DEFAULT_CURRENCY, getCurrencyConfig } from '@/config/currencies';
import { formatPrice } from '@/utils/currency';

export const useCurrency = () => {
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>(() => {
    // Try to get currency from URL params or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlCurrency = urlParams.get('currency') as CurrencyCode;
    
    if (urlCurrency && ['EUR', 'USD', 'GBP'].includes(urlCurrency)) {
      return urlCurrency;
    }
    
    const storedCurrency = localStorage.getItem('selectedCurrency') as CurrencyCode;
    if (storedCurrency && ['EUR', 'USD', 'GBP'].includes(storedCurrency)) {
      return storedCurrency;
    }
    
    return DEFAULT_CURRENCY;
  });

  const setCurrency = useCallback((currency: CurrencyCode) => {
    setSelectedCurrency(currency);
    localStorage.setItem('selectedCurrency', currency);
    
    // Update URL without navigation
    const url = new URL(window.location.href);
    url.searchParams.set('currency', currency);
    window.history.replaceState({}, '', url.toString());
  }, []);

  const formatCurrencyPrice = useCallback((amount: number) => {
    return formatPrice(amount, selectedCurrency);
  }, [selectedCurrency]);

  const getCurrentConfig = useCallback(() => {
    return getCurrencyConfig(selectedCurrency);
  }, [selectedCurrency]);

  return {
    selectedCurrency,
    setCurrency,
    formatPrice: formatCurrencyPrice,
    getCurrencyConfig: getCurrentConfig,
  };
};
```

## Phase 3: UI Components

### 3.1 Currency Selector Component (src/components/ui/CurrencySelector.tsx)
Create the currency toggle component:

```typescript
import React from 'react';
import { CurrencyCode } from '@/types/database';
import { getAllCurrencies } from '@/config/currencies';
import { useCurrency } from '@/hooks/useCurrency';

interface CurrencySelectorProps {
  className?: string;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({ 
  className = '' 
}) => {
  const { selectedCurrency, setCurrency } = useCurrency();
  const currencies = getAllCurrencies();

  return (
    <div className={`flex items-center bg-gray-800 rounded-lg p-1 border border-gray-600 ${className}`}>
      {currencies.map((currency) => (
        <button
          key={currency.code}
          onClick={() => setCurrency(currency.code)}
          className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 flex items-center gap-2 ${
            selectedCurrency === currency.code
              ? "bg-white text-black"
              : "text-gray-300 hover:text-white"
          }`}
          aria-label={`Select ${currency.code} currency`}
        >
          <span className="text-base" role="img" aria-label={`${currency.code} flag`}>
            {currency.flag}
          </span>
          <span>{currency.code}</span>
        </button>
      ))}
    </div>
  );
};
```

## Phase 4: Updated Configuration Files

### 4.1 Updated Stripe Client (src/utils/stripe/client.ts)
Modify the existing file to support multi-currency:

```typescript
// Add to existing imports
import { CurrencyCode } from '@/types/database';
import { MULTI_CURRENCY_PRICING } from '@/config/pricing';

// Replace STRIPE_PRODUCTS with multi-currency version
export const STRIPE_PRODUCTS_MULTI_CURRENCY = MULTI_CURRENCY_PRICING;

// Updated helper functions
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

export const calculateTotalAmount = (
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  currency: CurrencyCode,
  seats: number = 1
): number => {
  const priceConfig = getPriceConfig(planType, billingFrequency, currency);
  return priceConfig.amount * seats;
};

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
```

### 4.2 Updated Plans Configuration (src/config/plans.ts)
Modify to use multi-currency pricing:

```typescript
import { MultiCurrencyPlanConfig, CurrencyCode } from '@/types/database';
import { MULTI_CURRENCY_PRICING } from '@/config/pricing';

// Convert existing plans to multi-currency format
export const PLAN_CONFIGS_MULTI_CURRENCY: Record<'pro' | 'teams' | 'enterprise', MultiCurrencyPlanConfig> = {
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Perfect for individual developers',
    pricing: MULTI_CURRENCY_PRICING.pro,
    features: [
      'Unlimited Agent Requests',
      'Unlimited Tab Completion',
      '500 requests per month included',
      'Add more credits at API Price - No extra costs'
    ],
    credits: 500,
    isPopular: true,
  },
  teams: {
    id: 'teams',
    name: 'Teams',
    description: 'Ideal for development teams',
    pricing: MULTI_CURRENCY_PRICING.teams,
    features: [
      'Everything in Pro +',
      'Privacy mode',
      'Centralized Billing',
      'Admin dashboard with analytics',
      'Priority support',
    ],
    credits: 500,
    maxSeats: 100,
    isPopular: false,
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solutions for large organizations',
    pricing: {
      EUR: { monthly: 0, yearly: 0, priceIds: { monthly: '', yearly: '' } },
      USD: { monthly: 0, yearly: 0, priceIds: { monthly: '', yearly: '' } },
      GBP: { monthly: 0, yearly: 0, priceIds: { monthly: '', yearly: '' } }
    },
    features: [
      'Everything in Teams +',
      'Custom deployment',
      'SSO & SAML',
      'Dedicated support',
      'Advanced security',
      'Custom SLA agreements',
      'On-premise deployment'
    ],
    isContactSales: true,
    isPopular: false,
  },
};

// Helper function to get plan price for specific currency
export const getPlanPrice = (
  planId: 'pro' | 'teams' | 'enterprise',
  currency: CurrencyCode,
  billingFrequency: 'monthly' | 'yearly'
): number => {
  const plan = PLAN_CONFIGS_MULTI_CURRENCY[planId];
  if (plan.isContactSales) return 0;
  return plan.pricing[currency][billingFrequency];
};
```

## Phase 5: Component Updates

### 5.1 Updated PricingSection (src/components/PricingSection.tsx)
Major updates to integrate currency selector:

```typescript
// Add imports
import { CurrencySelector } from '@/components/ui/CurrencySelector';
import { useCurrency } from '@/hooks/useCurrency';
import { PLAN_CONFIGS_MULTI_CURRENCY, getPlanPrice } from '@/config/plans';

// Update component
export const PricingSection = () => {
  const [isYearly, setIsYearly] = useState(false);
  const { selectedCurrency, formatPrice } = useCurrency();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();

  const plans = [
    PLAN_CONFIGS_MULTI_CURRENCY.pro,
    PLAN_CONFIGS_MULTI_CURRENCY.teams,
    PLAN_CONFIGS_MULTI_CURRENCY.enterprise,
  ];

  const getPlanPriceDisplay = (plan: MultiCurrencyPlanConfig) => {
    if (plan.isContactSales) return 'Custom';
    const price = getPlanPrice(plan.id, selectedCurrency, isYearly ? 'yearly' : 'monthly');
    return formatPrice(price);
  };

  // Update layout to include currency selector
  return (
    <section className="bg-transparent pb-24">
      <div className="max-w-7xl mx-auto px-6">
        {/* Currency Selector */}
        <div className="flex justify-center items-center mb-6">
          <CurrencySelector />
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center items-center mb-12">
          {/* existing billing toggle code */}
        </div>

        {/* Rest of component with updated pricing display */}
      </div>
    </section>
  );
};
```

### 5.2 Updated Checkout Flow (src/utils/stripe/checkout.ts)
Modify checkout to support currency:

```typescript
// Update prepareCheckoutData function
export const prepareCheckoutDataWithCurrency = (
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  currency: CurrencyCode,
  clerkUserId: string,
  seats: number = 1
): StripeCheckoutDataWithCurrency => {
  const priceConfig = getPriceConfig(planType, billingFrequency, currency);
  const baseUrl = window.location.origin;
  
  return {
    planType,
    billingFrequency,
    currency,
    priceId: priceConfig.priceId,
    seats,
    clerkUserId,
    successUrl: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/payment/cancelled`,
  };
};
```

## Phase 6: Testing and Validation

### 6.1 Unit Tests
- Currency formatting functions
- Price calculation utilities
- Currency selector component
- useCurrency hook

### 6.2 Integration Tests
- Pricing display with different currencies
- Currency toggle functionality
- Checkout flow with currency-specific price IDs

### 6.3 E2E Tests
- Complete user journey with currency selection
- Payment flow with different currencies
- URL state persistence

## Implementation Checklist

### Phase 1: Foundation
- [ ] Add currency types to database.ts
- [ ] Create currencies.ts configuration
- [ ] Create pricing.ts with all price data
- [ ] Create currency.ts utilities

### Phase 2: Core Logic
- [ ] Create useCurrency hook
- [ ] Update Stripe client configuration
- [ ] Update plans configuration
- [ ] Update checkout utilities

### Phase 3: UI Components
- [ ] Create CurrencySelector component
- [ ] Update PricingSection component
- [ ] Integrate currency selector into pricing page

### Phase 4: Integration
- [ ] Update checkout flow
- [ ] Add URL state management
- [ ] Test currency persistence
- [ ] Verify Stripe integration

### Phase 5: Polish
- [ ] Add loading states
- [ ] Add error handling
- [ ] Optimize performance
- [ ] Add accessibility features

This comprehensive plan provides the exact specifications needed to implement multi-currency pricing with EUR as the default, complete with flag icons and proper Stripe integration.