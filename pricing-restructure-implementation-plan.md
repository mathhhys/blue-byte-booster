# Pricing Plans Restructure Implementation Plan

## Overview
Remove duplicate popup functionality from pricing plans and restructure plans to show Pro, Teams, Enterprise (removing Starter plan).

## Current Issues Identified
1. **Duplicate Functionality**: `PricingSection` opens `AuthFlowModal` which shows the same plans again
2. **Plan Structure**: Currently shows Starter, Pro, Teams - needs to be Pro, Teams, Enterprise
3. **Authentication Flow**: Modal-based signup creates unnecessary UX friction

## Implementation Steps

### 1. Update Type Definitions (`src/types/database.ts`)

#### Plan Configuration Type Updates
```typescript
// Update PlanConfig interface
export interface PlanConfig {
  id: 'pro' | 'teams' | 'enterprise';  // Remove 'starter', add 'enterprise'
  name: string;
  description: string;
  price: {
    monthly: number | null;  // null for enterprise (custom pricing)
    yearly: number | null;   // null for enterprise (custom pricing)
  };
  features: string[];
  credits?: number;  // Optional for enterprise
  maxSeats?: number;
  isPopular?: boolean;
  isContactSales?: boolean;  // New field for enterprise
}

// Update AuthFlowState
export interface AuthFlowState {
  isOpen: boolean;
  selectedPlan?: 'pro' | 'teams' | 'enterprise';  // Remove 'starter'
  billingFrequency: 'monthly' | 'yearly';
  seats: number;
  isLoading: boolean;
  error?: string;
}
```

### 2. Update Plan Configuration (`src/config/plans.ts`)

#### Remove Starter Plan and Add Enterprise
```typescript
export const PLAN_CONFIGS: Record<'pro' | 'teams' | 'enterprise', PlanConfig> = {
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Perfect for individual developers',
    price: {
      monthly: 20,
      yearly: 16,
    },
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
    price: {
      monthly: 30,
      yearly: 24,
    },
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
    price: {
      monthly: null,
      yearly: null,
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
```

### 3. Update PricingSection Component (`src/components/PricingSection.tsx`)

#### Key Changes:
1. **Remove AuthFlowModal dependency**
2. **Add direct navigation to signup**
3. **Handle Enterprise contact sales**
4. **Reorder plans display**

#### New Implementation Structure:
```typescript
// Remove AuthFlowModal import and useAuthFlow hook
// Remove modal state management

// Update plans array to new order
const plans = [
  PLAN_CONFIGS.pro,
  PLAN_CONFIGS.teams,
  // Enterprise will be handled separately
];

// New click handler for direct navigation
const handlePlanClick = (planId: 'pro' | 'teams' | 'enterprise') => {
  if (planId === 'enterprise') {
    // Redirect to contact sales form/page
    window.location.href = '/contact-sales';
    return;
  }

  if (!isLoaded || !isSignedIn) {
    // Redirect to sign-up with plan pre-selected
    const params = new URLSearchParams({
      plan: planId,
      billing: isYearly ? 'yearly' : 'monthly',
    });
    navigate(`/sign-up?${params.toString()}`);
  } else {
    // User is signed in, redirect to dashboard or handle upgrade
    navigate('/dashboard');
  }
};
```

### 4. Update Pricing Page (`src/pages/Pricing.tsx`)

#### Remove Duplicate Plan Data
- Remove the `pricingPlans` array (lines 13-94) as this duplicates the data in `PricingSection`
- Update comparison table to show Pro, Teams, Enterprise instead of including Free plan
- Update FAQ section if it references Starter plan

#### Comparison Table Updates:
```typescript
const comparisonFeatures = [
  {
    category: "AI & Coding",
    features: [
      { name: "AI Prompts/month", pro: "500 included", teams: "500 per user", enterprise: "Unlimited" },
      { name: "Model Access", pro: "All models", teams: "All models", enterprise: "All + custom models" },
      // ... other features
    ]
  },
  // ... other categories
];
```

### 5. Create Contact Sales Page (Optional)

#### New file: `src/pages/ContactSales.tsx`
- Contact form for Enterprise inquiries
- Feature highlights for Enterprise plan
- Sales team contact information

### 6. Update Authentication Flow

#### Remove Modal Dependencies:
- Update any components that reference the removed AuthFlowModal
- Ensure direct navigation to `/sign-up` with plan parameters works correctly
- Update post-signup flow to handle plan selection from URL parameters

### 7. Database Migration Considerations

#### Note on Data Migration:
- Users with 'starter' plan in database will need migration strategy
- Consider mapping existing starter users to pro trial or maintaining backward compatibility
- Update any database constraints that reference 'starter' plan type

### 8. Files to Update

#### Required File Changes:
1. `src/types/database.ts` - Update type definitions
2. `src/config/plans.ts` - Update plan configurations
3. `src/components/PricingSection.tsx` - Complete rewrite to remove modal
4. `src/pages/Pricing.tsx` - Remove duplicate plan data, update comparison
5. `src/hooks/useAuthFlow.ts` - May need updates or could be deprecated
6. `src/components/auth/AuthFlowModal.tsx` - May be deprecated
7. Any other components referencing 'starter' plan

#### Optional New Files:
1. `src/pages/ContactSales.tsx` - Enterprise contact form
2. Migration scripts for database if needed

### 9. Testing Requirements

#### Areas to Test:
1. **Plan Display**: Verify Pro, Teams, Enterprise display in correct order
2. **Direct Signup**: Test signup flow with plan pre-selection
3. **Enterprise Contact**: Verify Enterprise button redirects correctly
4. **Responsive Design**: Test layout on all device sizes
5. **Authentication States**: Test signed in vs signed out user flows
6. **Pricing Toggle**: Verify monthly/yearly pricing works correctly

### 10. Implementation Order

1. Update type definitions and plan configurations
2. Update PricingSection component (remove modal, add direct navigation)
3. Update Pricing page (remove duplicates, update comparison)
4. Create Contact Sales page (if needed)
5. Update other files that reference starter plan
6. Test all functionality
7. Handle any database migration needs

## Success Criteria

- ✅ No duplicate pricing plan display
- ✅ Direct signup flow without modal popup
- ✅ Plans display in order: Pro, Teams, Enterprise
- ✅ Enterprise plan redirects to contact sales
- ✅ Responsive design maintained
- ✅ All existing functionality preserved for Pro and Teams plans
- ✅ Clean removal of Starter plan references