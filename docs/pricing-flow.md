# Pricing Flow Documentation

## Overview
This document describes the current pricing and signup flow for Softcodes, focusing on the reproduction of the "old path" where users create a Clerk account and are then redirected to Stripe for payment.

## Flow for Pro Plan (EUR Monthly)
1. **User Access**: User visits `/pricing` or homepage pricing section.
2. **Button Click**: User clicks "Start 14-Day Free Trial" on the Pro card in [`PricingSection.tsx`](src/components/PricingSection.tsx:58).
3. **Redirect to Signup**: Links to `/sign-up?plan=pro&billing=monthly&currency=EUR` ([`SignUp.tsx`](src/pages/SignUp.tsx:20-32)).
4. **Clerk Signup**: User creates account via Clerk's signup component ([`SignUp.tsx`](src/pages/SignUp.tsx:62)).
5. **Post-Signup Processing**: After signup, redirects to `/auth/post-signup` with params ([`SignUp.tsx`](src/pages/SignUp.tsx:82)).
6. **User Initialization**: In [`PostSignup.tsx`](src/pages/PostSignup.tsx:69-88), initializes user in database via `/api/user/initialize`.
7. **Checkout Preparation**: Prepares multi-currency data with priceId for Pro EUR monthly (`price_1RvK8KH6gWxKcaTXO4AlW0MQ`) from [`src/config/pricing.ts`](src/config/pricing.ts:9) via [`getPriceId`](src/utils/stripe/client.ts:141) ([`PostSignup.tsx`](src/pages/PostSignup.tsx:91-97)).
8. **Stripe Session Creation**: Calls `createMultiCurrencyCheckoutSession` ([`src/utils/stripe/checkout.ts`](src/utils/stripe/checkout.ts:8)), which hits `/api/stripe/create-checkout-session` ([`api/stripe/create-checkout-session.js`](api/stripe/create-checkout-session.js:17)).
9. **API Processing**: API validates priceId, creates/finds customer, creates Stripe checkout session with EUR price, redirects to Stripe ([`api/stripe/create-checkout-session.js`](api/stripe/create-checkout-session.js:192-229)).
10. **Payment Completion**: After Stripe payment, redirects to `/payment-success` for success handling.

## Flow for Teams Plan
- Remains unchanged: Button links to `mailto:mathys@softcodes.io` for custom pricing inquiries ([`PricingSection.tsx`](src/components/PricingSection.tsx:96)).
- No automated signup/Stripe flow; direct contact required.

## Starter Plan (Not in Pricing Focus)
- For free tier, handled separately via `/sign-up?plan=starter` → [`PostSignup.tsx`](src/pages/PostSignup.tsx:46-65) → `/api/starter/process-signup.js` → Dashboard.

## Key Files
- **Frontend**: [`PricingSection.tsx`](src/components/PricingSection.tsx), [`SignUp.tsx`](src/pages/SignUp.tsx), [`PostSignup.tsx`](src/pages/PostSignup.tsx)
- **Utils**: [`src/utils/stripe/checkout.ts`](src/utils/stripe/checkout.ts), [`src/utils/stripe/client.ts`](src/utils/stripe/client.ts)
- **Config**: [`src/config/pricing.ts`](src/config/pricing.ts)
- **API**: [`api/stripe/create-checkout-session.js`](api/stripe/create-checkout-session.js), [`api/starter/process-signup.js`](api/starter/process-signup.js)

## Notes
- Supports 14-day free trial via Stripe subscription setup.
- Currency fixed to EUR for Pro; priceId ensures correct billing.
- Seats default to 1 for Pro; Teams uses custom contact.
- Flow applies to both homepage and `/pricing` page (shared component).
- Error handling: Retries available in PostSignup; logs in API.

Last Updated: 2025-11-07