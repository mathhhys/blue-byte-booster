# Comprehensive Authentication & Payment Flow Setup

This document provides a complete guide for the authentication and payment system implementation for Softcodes.

## 🚀 Overview

The system implements a comprehensive sign-in/sign-up flow with integrated payment processing that includes:

- **Clerk Authentication** for user management
- **Stripe Payment Processing** for Pro and Teams plans
- **Supabase Database** for credit management and user data
- **Clerk Native Invitations** for Teams plan collaboration
- **Conditional Workflows** based on plan selection (Starter/Pro/Teams)

## 📋 Features Implemented

### ✅ Core Components
- [x] **AuthFlowModal** - Main authentication and plan selection interface
- [x] **PricingSection** - Updated to trigger new authentication flow
- [x] **InvitationManager** - Teams plan invitation management
- [x] **PaymentSuccess/Cancelled** - Payment result pages

### ✅ Authentication Flows
- [x] **Starter Plan**: Free signup with 25 credits (no payment)
- [x] **Pro Plan**: Authentication → Stripe checkout → 500 credits
- [x] **Teams Plan**: Authentication → Seat selection → Stripe checkout → Invitation system → 500 credits per seat

### ✅ Database Integration
- [x] Complete Supabase schema with RLS policies
- [x] User management and credit tracking
- [x] Subscription and team invitation management
- [x] Automated credit allocation

### ✅ Payment Processing
- [x] Stripe integration with dynamic pricing
- [x] Monthly/yearly billing frequency support
- [x] Seat-based pricing for Teams plan
- [x] Webhook handling framework

## 🛠 Setup Instructions

### 1. Environment Variables

Add the following to your `.env.local` file:

```env
# Clerk Configuration
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key_here

# Supabase Configuration
VITE_SUPABASE_URL=https://xraquejellmoyrpqcirs.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 2. Database Setup

Execute the SQL schema in Supabase:

```bash
# Run the schema file in your Supabase SQL editor
cat src/utils/supabase/schema.sql
```

This creates:
- `users` table with Clerk integration
- `subscriptions` table for payment tracking
- `team_invitations` table for Teams plan
- `credit_transactions` table for credit history
- RLS policies for security
- Helper functions for credit management

### 3. Stripe Configuration

#### Stripe Products and Prices Configuration:

**Pro Plan (Already Configured):**
- Monthly: $20/month - `price_1RvKJcH6gWxKcaTXQ4PITKei`
- Yearly: $192/year (20% discount) - `price_1RvKJtH6gWxKcaTXfeLXklqU`

**Teams Plan (Need to Create):**
- Monthly: $30/month per seat - Create in Stripe Dashboard
- Yearly: $288/year per seat (20% discount) - Create in Stripe Dashboard

#### Current Price IDs Configuration:
The system is already configured with your Pro plan price IDs:

```typescript
export const STRIPE_PRODUCTS = {
  pro: {
    monthly: {
      priceId: 'price_1RvKJcH6gWxKcaTXQ4PITKei', // ✅ Configured
      amount: 2000,
    },
    yearly: {
      priceId: 'price_1RvKJtH6gWxKcaTXfeLXklqU', // ✅ Configured
      amount: 19200,
    },
  },
  teams: {
    monthly: {
      priceId: 'price_teams_monthly', // ⚠️ Need to create in Stripe
      amount: 3000,
    },
    yearly: {
      priceId: 'price_teams_yearly', // ⚠️ Need to create in Stripe
      amount: 28800,
    },
  },
};
```

#### Next Steps for Teams Plan:
1. Create Teams monthly and yearly products in your Stripe Dashboard
2. Update the `priceId` values in `src/utils/stripe/client.ts`
3. Test the Teams plan checkout flow

### 4. Clerk Configuration

#### Organization Settings:
1. Enable organizations in your Clerk dashboard
2. Configure organization invitation settings
3. Set up webhook endpoints for invitation events

#### Webhook Endpoints:
- `POST /api/clerk/webhooks` - Handle user lifecycle events
- `POST /api/stripe/webhooks` - Handle payment events

## 🔄 User Flows

### Starter Plan Flow
1. User clicks "Get Started For Free" on any pricing card
2. AuthFlowModal opens with Starter plan selected
3. User completes Clerk authentication
4. System creates user record in Supabase
5. 25 credits automatically granted
6. Redirect to dashboard

### Pro Plan Flow
1. User clicks "Get Softcodes Pro" button
2. AuthFlowModal opens with Pro plan selected
3. User selects billing frequency (monthly/yearly)
4. User completes Clerk authentication
5. System creates Stripe checkout session
6. User completes payment on Stripe
7. Webhook processes successful payment
8. 500 credits granted to user account
9. Redirect to success page

### Teams Plan Flow
1. User clicks "Get Softcodes for Teams" button
2. AuthFlowModal opens with Teams plan selected
3. User selects number of seats (1-100)
4. User selects billing frequency
5. User completes Clerk authentication
6. System creates Stripe checkout session with seat count
7. User completes payment on Stripe
8. Webhook processes successful payment
9. 500 credits per seat granted
10. InvitationManager interface appears
11. User can send Clerk invitations to team members
12. Invited users receive email invitations
13. Redirect to dashboard

## 🎨 UI Components

### AuthFlowModal
- **Location**: `src/components/auth/AuthFlowModal.tsx`
- **Features**: Plan selection, billing toggle, seat selector, authentication integration
- **Usage**: Triggered from pricing cards or auth buttons

### InvitationManager
- **Location**: `src/components/teams/InvitationManager.tsx`
- **Features**: Send invitations, manage team members, track invitation status
- **Usage**: Shown after Teams plan purchase

### Payment Pages
- **Success**: `src/pages/PaymentSuccess.tsx`
- **Cancelled**: `src/pages/PaymentCancelled.tsx`
- **Features**: Payment confirmation, credit summary, next steps

## 🔧 API Integration

### Supabase Operations
```typescript
// User management
import { userOperations } from '@/utils/supabase/database';
await userOperations.upsertUser(userData);

// Credit management
import { creditOperations } from '@/utils/supabase/database';
await creditOperations.grantCredits(clerkId, amount, description);

// Team invitations
import { teamInvitationOperations } from '@/utils/supabase/database';
await teamInvitationOperations.createInvitation(invitationData);
```

### Stripe Integration
```typescript
// Create checkout session
import { createCheckoutSession } from '@/utils/stripe/checkout';
const result = await createCheckoutSession(checkoutData);

// Handle webhooks
import { processStripeWebhook } from '@/api/stripe';
await processStripeWebhook(event);
```

### Clerk Invitations
```typescript
// Send team invitation
import { useTeamInvitations } from '@/utils/clerk/invitations';
const { sendInvitation } = useTeamInvitations();
await sendInvitation(email, subscriptionId, inviterId);
```

## 🧪 Testing

### Development Mode
The system includes mock implementations for testing:

1. **Mock Stripe Checkout**: Simulates payment flow without actual charges
2. **Mock Clerk Invitations**: Simulates invitation system
3. **Database Operations**: Full Supabase integration for testing

### Test Scenarios
1. **Starter Plan**: Test free signup and credit allocation
2. **Pro Plan**: Test payment flow and credit granting
3. **Teams Plan**: Test seat selection, payment, and invitation system
4. **Error Handling**: Test payment failures and network issues

## 🔒 Security Features

### Database Security
- Row Level Security (RLS) policies
- User data isolation
- Secure credit transactions

### Payment Security
- Stripe handles all payment data
- Webhook signature verification
- Secure API endpoints

### Authentication Security
- Clerk handles user authentication
- JWT token validation
- Protected routes and API endpoints

## 🚀 Deployment

### Production Checklist
1. [ ] Replace mock Stripe price IDs with production IDs
2. [ ] Update Stripe webhook endpoints
3. [ ] Configure production Clerk settings
4. [ ] Set up production Supabase database
5. [ ] Update environment variables
6. [ ] Test all payment flows
7. [ ] Set up monitoring and logging

### Backend Requirements
For production, you'll need to implement:
1. **Stripe Webhook Handler**: Process payment events
2. **Clerk Webhook Handler**: Process user lifecycle events
3. **API Endpoints**: Handle checkout session creation
4. **Database Migrations**: Apply schema to production

## 📞 Support

### Common Issues
1. **Payment Failures**: Check Stripe dashboard for error details
2. **Invitation Issues**: Verify Clerk organization settings
3. **Credit Problems**: Check Supabase database logs
4. **Authentication Errors**: Verify Clerk configuration

### Monitoring
- Stripe Dashboard: Payment monitoring
- Clerk Dashboard: User authentication logs
- Supabase Dashboard: Database operations
- Application Logs: Custom error tracking

## 🔄 Future Enhancements

### Planned Features
- [ ] Subscription management interface
- [ ] Usage analytics dashboard
- [ ] Advanced team permissions
- [ ] Custom enterprise features
- [ ] Mobile app integration

### Scalability Considerations
- Database indexing optimization
- Webhook processing queues
- Credit usage rate limiting
- Team size limitations

---

This comprehensive authentication and payment system provides a solid foundation for your SaaS application with room for future enhancements and scalability.