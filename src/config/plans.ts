import { PlanConfig } from '@/types/database';

// Plan configurations matching the existing pricing structure
export const PLAN_CONFIGS: Record<'starter' | 'pro' | 'teams', PlanConfig> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Pro two-week trial',
    price: {
      monthly: 0,
      yearly: 0,
    },
    features: [
      'Limited Agent requests',
      'Limited Tab completions'
    ],
    credits: 25,
    isPopular: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    description: 'Extended limits on Agent',
    price: {
      monthly: 20,
      yearly: 16,
    },
    features: [
      'Unlimited Tab completions',
      'Access to Background Agents',
      'Access to Bugbot',
      'Access to maximum context windows',
      'Add more credits at API Price - No extra costs'
    ],
    credits: 500,
    isPopular: true,
  },
  teams: {
    id: 'teams',
    name: 'Teams',
    description: '20x usage on all OpenAI/Claude/Gemini models',
    price: {
      monthly: 30,
      yearly: 24,
    },
    features: [
      'Automated zero data retention',
      'Centralized Billing',
      'Admin dashboard with analytics',
      'Priority support'
    ],
    credits: 500,
    maxSeats: 100,
    isPopular: false,
  },
};

// Helper functions for plan operations
export const getPlanConfig = (planId: 'starter' | 'pro' | 'teams'): PlanConfig => {
  return PLAN_CONFIGS[planId];
};

export const getAllPlans = (): PlanConfig[] => {
  return Object.values(PLAN_CONFIGS);
};

export const getPaidPlans = (): PlanConfig[] => {
  return Object.values(PLAN_CONFIGS).filter(plan => plan.price.monthly > 0);
};

export const calculatePlanPrice = (
  planId: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  seats: number = 1
): number => {
  const plan = PLAN_CONFIGS[planId];
  const basePrice = billingFrequency === 'monthly' ? plan.price.monthly : plan.price.yearly;
  return basePrice * seats;
};

export const calculateSavings = (planId: 'pro' | 'teams'): number => {
  const plan = PLAN_CONFIGS[planId];
  const monthlyTotal = plan.price.monthly * 12;
  const yearlyTotal = plan.price.yearly * 12;
  return Math.round(((monthlyTotal - yearlyTotal) / monthlyTotal) * 100);
};

export const formatPlanPrice = (
  planId: 'starter' | 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  seats: number = 1
): string => {
  const plan = PLAN_CONFIGS[planId];
  
  if (plan.price.monthly === 0) {
    return 'Free';
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
            starter: 'Limited',
            pro: 'Unlimited',
            teams: 'Unlimited',
          },
          {
            name: 'Tab Completions',
            starter: 'Limited',
            pro: 'Unlimited',
            teams: 'Unlimited',
          },
          {
            name: 'Background Agents',
            starter: false,
            pro: true,
            teams: true,
          },
          {
            name: 'Bugbot Access',
            starter: false,
            pro: true,
            teams: true,
          },
          {
            name: 'Maximum Context Windows',
            starter: false,
            pro: true,
            teams: true,
          },
        ],
      },
      {
        name: 'Collaboration',
        features: [
          {
            name: 'Team Members',
            starter: '1',
            pro: '1',
            teams: 'Up to 100',
          },
          {
            name: 'Centralized Billing',
            starter: false,
            pro: false,
            teams: true,
          },
          {
            name: 'Admin Dashboard',
            starter: false,
            pro: false,
            teams: true,
          },
          {
            name: 'Zero Data Retention',
            starter: false,
            pro: false,
            teams: true,
          },
        ],
      },
      {
        name: 'Support & Pricing',
        features: [
          {
            name: 'Support Level',
            starter: 'Community',
            pro: 'Standard',
            teams: 'Priority',
          },
          {
            name: 'API Price Credits',
            starter: false,
            pro: true,
            teams: true,
          },
          {
            name: 'Usage Analytics',
            starter: false,
            pro: 'Basic',
            teams: 'Advanced',
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

  if (!['starter', 'pro', 'teams'].includes(planId)) {
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

  return {
    valid: errors.length === 0,
    errors,
  };
};