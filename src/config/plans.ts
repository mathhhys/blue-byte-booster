import { PlanConfig } from '@/types/database';

// Plan configurations matching the existing pricing structure
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

// Helper functions for plan operations
export const getPlanConfig = (planId: 'pro' | 'teams' | 'enterprise'): PlanConfig => {
  return PLAN_CONFIGS[planId];
};

export const getAllPlans = (): PlanConfig[] => {
  return Object.values(PLAN_CONFIGS);
};

export const getPaidPlans = (): PlanConfig[] => {
  return Object.values(PLAN_CONFIGS).filter(plan => plan.price.monthly && plan.price.monthly > 0);
};

export const calculatePlanPrice = (
  planId: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  seats: number = 1
): number => {
  const plan = PLAN_CONFIGS[planId];
  const basePrice = billingFrequency === 'monthly' ? plan.price.monthly : plan.price.yearly;
  if (!basePrice) return 0;
  return basePrice * seats;
};

export const calculateSavings = (planId: 'pro' | 'teams'): number => {
  const plan = PLAN_CONFIGS[planId];
  if (!plan.price.monthly || !plan.price.yearly) return 0;
  const monthlyTotal = plan.price.monthly * 12;
  const yearlyTotal = plan.price.yearly * 12;
  return Math.round(((monthlyTotal - yearlyTotal) / monthlyTotal) * 100);
};

export const formatPlanPrice = (
  planId: 'pro' | 'teams' | 'enterprise',
  billingFrequency: 'monthly' | 'yearly',
  seats: number = 1
): string => {
  const plan = PLAN_CONFIGS[planId];
  
  if (plan.isContactSales) {
    return 'Contact Sales';
  }
  
  if (!plan.price.monthly) {
    return 'Custom';
  }
  
  const price = calculatePlanPrice(planId as 'pro' | 'teams', billingFrequency, seats);
  const period = billingFrequency === 'monthly' ? 'mo' : 'yr';
  
  if (seats > 1) {
    const perSeat = billingFrequency === 'monthly' ? plan.price.monthly : plan.price.yearly;
    return `$${price}/${period} ($${perSeat}/seat)`;
  }
  
  return `$${price}/${period}`;
};

// Plan feature comparison helpers
export const getFeatureComparison = () => {
  return {
    categories: [
      {
        name: 'AI & Coding',
        features: [
          {
            name: 'Agent Requests',
            pro: 'Unlimited',
            teams: 'Unlimited',
            enterprise: 'Unlimited',
          },
          {
            name: 'Tab Completions',
            pro: 'Unlimited',
            teams: 'Unlimited',
            enterprise: 'Unlimited',
          },
          {
            name: 'Background Agents',
            pro: true,
            teams: true,
            enterprise: true,
          },
          {
            name: 'Bugbot Access',
            pro: true,
            teams: true,
            enterprise: true,
          },
          {
            name: 'Maximum Context Windows',
            pro: true,
            teams: true,
            enterprise: true,
          },
          {
            name: 'Custom Model Training',
            pro: false,
            teams: false,
            enterprise: true,
          },
        ],
      },
      {
        name: 'Collaboration',
        features: [
          {
            name: 'Team Members',
            pro: '1',
            teams: 'Up to 100',
            enterprise: 'Unlimited',
          },
          {
            name: 'Centralized Billing',
            pro: false,
            teams: true,
            enterprise: true,
          },
          {
            name: 'Admin Dashboard',
            pro: false,
            teams: true,
            enterprise: 'Advanced',
          },
          {
            name: 'Zero Data Retention',
            pro: false,
            teams: true,
            enterprise: true,
          },
          {
            name: 'SSO & SAML',
            pro: false,
            teams: false,
            enterprise: true,
          },
        ],
      },
      {
        name: 'Support & Security',
        features: [
          {
            name: 'Support Level',
            pro: 'Standard',
            teams: 'Priority',
            enterprise: 'Dedicated',
          },
          {
            name: 'API Price Credits',
            pro: true,
            teams: true,
            enterprise: true,
          },
          {
            name: 'Usage Analytics',
            pro: 'Basic',
            teams: 'Advanced',
            enterprise: 'Enterprise',
          },
          {
            name: 'Custom SLA',
            pro: false,
            teams: false,
            enterprise: true,
          },
          {
            name: 'On-premise Deployment',
            pro: false,
            teams: false,
            enterprise: true,
          },
        ],
      },
    ],
  };
};

// Validation helpers
export const validatePlanSelection = (
  planId: string,
  billingFrequency: string,
  seats?: number
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!['pro', 'teams', 'enterprise'].includes(planId)) {
    errors.push('Invalid plan selected');
  }

  if (!['monthly', 'yearly'].includes(billingFrequency)) {
    errors.push('Invalid billing frequency');
  }

  if (planId === 'teams') {
    if (!seats || seats < 1 || seats > 100) {
      errors.push('Teams plan requires 1-100 seats');
    }
  }

  if (planId === 'enterprise') {
    // Enterprise plan has different validation rules
    // No seats validation needed for enterprise
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};