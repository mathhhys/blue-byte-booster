# Multi-Currency Pricing Architecture Specification

## Overview
Implementation plan for adding EUR, USD, and GBP currency support to the pricing system with a currency toggle selector featuring flag icons.

## Current State Analysis ✅
- **PricingSection.tsx**: Uses hardcoded USD pricing from PLAN_CONFIGS
- **plans.ts**: Contains static USD-only pricing configuration
- **stripe/client.ts**: Hardcoded USD price IDs in STRIPE_PRODUCTS
- **checkout.ts**: Single-currency checkout flow
- **types/database.ts**: PlanConfig type supports only single currency

## Target Architecture

### 1. Currency Configuration System
```typescript
// New types for multi-currency support
interface CurrencyConfig {
  code: 'EUR' | 'USD' | 'GBP';
  symbol: string;
  flag: string;
  locale: string;
  isDefault?: boolean;
}

interface MultiCurrencyPrice {
  EUR: { monthly: number; yearly: number; priceIds: { monthly: string; yearly: string } };
  USD: { monthly: number; yearly: number; priceIds: { monthly: string; yearly: string } };
  GBP: { monthly: number; yearly: number; priceIds: { monthly: string; yearly: string } };
}
```

### 2. Updated Data Structure
Complete pricing matrix with all provided Stripe price IDs:

**Pro Plan:**
- EUR: €20/month (price_1RvK8KH6gWxKcaTXCWyv035N), €192/year (price_1RvK8LH6gWxKcaTXqqNXiuus)
- USD: $20/month (price_1RvK8KH6gWxKcaTXCWyv035N), $192/year (price_1RvK8KH6gWxKcaTXEn1S0Lql)
- GBP: £16/month (price_1RvK8KH6gWxKcaTXQvGGVCNI), £150/year (price_1RvK8KH6gWxKcaTXYTeJ18no)

**Teams Plan:**
- EUR: €30/month (price_1RwN6oH6gWxKcaTXgmKllDYt), €288/year (price_1RwN8QH6gWxKcaTX7thDBBm7)
- USD: $30/month (price_1RwN7VH6gWxKcaTXHVkwwT60), $288/year (price_1RwN8hH6gWxKcaTXEaGbVvhz)
- GBP: £24/month (price_1RwN7uH6gWxKcaTX0jJCR7uU), £225/year (price_1RwN9FH6gWxKcaTXQBUURC9T)

### 3. Component Architecture

#### CurrencySelector Component
```
┌─────────────────────────────────────┐
│ [ 🇪🇺 EUR ] [ 🇺🇸 USD ] [ 🇬🇧 GBP ]  │
└─────────────────────────────────────┘
```
- Flag icons with currency codes
- Toggle functionality similar to monthly/yearly
- EUR as default selection
- Smooth transitions and hover effects

#### Updated PricingSection Layout
```
┌──────────────────────────────────────────┐
│           Currency Selector               │
│   [ 🇪🇺 EUR ] [ 🇺🇸 USD ] [ 🇬🇧 GBP ]    │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│         Monthly/Yearly Toggle            │
│      [ Monthly ] [ Yearly 20% off ]      │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│              Pricing Cards               │
│    [ Pro ]    [ Teams ]   [ Enterprise ] │
└──────────────────────────────────────────┘
```

### 4. Implementation Files

#### New Files to Create:
1. **`src/config/currencies.ts`** - Currency definitions and pricing matrix
2. **`src/components/ui/CurrencySelector.tsx`** - Currency toggle component
3. **`src/hooks/useCurrency.ts`** - Currency state management hook
4. **`src/utils/currency.ts`** - Currency formatting utilities

#### Files to Modify:
1. **`src/types/database.ts`** - Add multi-currency types
2. **`src/config/plans.ts`** - Update to use multi-currency pricing
3. **`src/utils/stripe/client.ts`** - Add all currency price IDs
4. **`src/components/PricingSection.tsx`** - Integrate currency selector
5. **`src/utils/stripe/checkout.ts`** - Support currency-specific checkout

### 5. State Management

#### Currency Context/Hook
```typescript
interface CurrencyState {
  selectedCurrency: 'EUR' | 'USD' | 'GBP';
  setCurrency: (currency: 'EUR' | 'USD' | 'GBP') => void;
  formatPrice: (amount: number) => string;
  getCurrencyConfig: () => CurrencyConfig;
}
```

#### URL State Persistence
- Add currency parameter to URL: `/pricing?currency=EUR`
- Remember user's currency preference
- Default to EUR if no preference set

### 6. Integration Points

#### Stripe Integration
- Currency-specific price ID resolution
- Proper checkout session creation with correct currency
- Support for Stripe's multi-currency capabilities

#### Formatting System
- Locale-aware number formatting
- Currency symbol positioning
- Proper decimal places for each currency

#### Responsive Design
- Mobile-optimized currency selector
- Proper flag icon sizing
- Accessible design patterns

## Implementation Benefits

✅ **Enhanced UX**: Users see prices in their preferred currency
✅ **Global Market**: Support for EU, US, and UK markets
✅ **Conversion Reduction**: No mental currency conversion needed
✅ **Payment Optimization**: Stripe handles local payment methods
✅ **Brand Localization**: Shows commitment to international users
✅ **SEO Benefits**: Currency-specific pricing for better search visibility

## Technical Considerations

### Performance
- Lazy load currency configurations
- Memoize currency formatting functions
- Efficient re-renders on currency change

### Accessibility
- Screen reader support for currency selector
- Keyboard navigation support
- High contrast mode compatibility

### Testing Strategy
- Unit tests for currency utilities
- Integration tests for pricing display
- E2E tests for checkout flow
- Visual regression tests for currency selector

### Browser Support
- Modern browsers with Intl.NumberFormat support
- Fallback for older browsers
- Progressive enhancement approach

## Success Metrics
- Conversion rate improvement by region
- Reduced cart abandonment
- Increased international signups
- Positive user feedback on currency selection

This architecture provides a solid foundation for multi-currency pricing while maintaining clean code organization and optimal user experience.