// Credit system types and interfaces

export interface CreditBalance {
  balance: number;
  lastUpdated?: Date;
}

export interface AddCreditsRequest {
  credits: number; // Number of credits to purchase
  amount: number; // Calculated euro amount
}

export interface AddCreditsResponse {
  success: boolean;
  newBalance?: number;
  creditsAdded?: number;
  transactionId?: string;
  clientSecret?: string; // For Stripe payments
  error?: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number; // Credits amount (positive for additions, negative for usage)
  euroAmount?: number; // Original euro amount for credit purchases
  description: string;
  type: 'purchase' | 'usage' | 'refund' | 'bonus';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  transactionId?: string;
  stripePaymentIntentId?: string;
  createdAt: Date;
  updatedAt?: Date;
  metadata?: Record<string, any>;
}

export interface CreditConversion {
  eurosToCredits: (euros: number) => number;
  creditsToEuros: (credits: number) => number;
  CREDITS_PER_EURO: number;
  EUROS_PER_CREDIT: number;
}

export interface CreditValidation {
  valid: boolean;
  error?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface QuickSelectAmount {
  label: string;
  credits: number; // Number of credits
  cost: number; // Euro cost
  popular?: boolean;
}

// Credit conversion utilities
export const CREDIT_CONVERSION: CreditConversion = {
  CREDITS_PER_EURO: 500 / 7, // ≈71.428571 credits per euro
  EUROS_PER_CREDIT: 7 / 500, // ≈0.014 euros per credit
  eurosToCredits: (euros: number) => Math.floor(euros * (500 / 7)),
  creditsToEuros: (credits: number) => Number((credits * (7 / 500)).toFixed(2))
};

// Predefined quick-select amounts
export const QUICK_SELECT_AMOUNTS: QuickSelectAmount[] = [
  {
    label: '500 credits',
    credits: 500,
    cost: CREDIT_CONVERSION.creditsToEuros(500),
  },
  {
    label: '1500 credits',
    credits: 1500,
    cost: CREDIT_CONVERSION.creditsToEuros(1500),
    popular: true
  },
  {
    label: '3000 credits',
    credits: 3000,
    cost: CREDIT_CONVERSION.creditsToEuros(3000),
  }
];

// Validation constraints
export const CREDIT_LIMITS = {
  MIN_PURCHASE_CREDITS: 71, // Equivalent to €1.00
  MAX_PURCHASE_CREDITS: 71428, // Equivalent to €1000.00
  MIN_PURCHASE_AMOUNT: 1.00,
  MAX_PURCHASE_AMOUNT: 1000.00,
} as const;

// Organization credit types
export interface OrgCreditBalance {
  total_credits: number;
  used_credits: number;
  remaining_credits: number;
  seats_total: number;
  seats_used: number;
  plan_type: string;
  billing_frequency: string;
}

export interface OrgCreditTopupRequest {
  orgId: string;
  credits_amount: number;
}

export interface OrgCreditTopupResponse {
  success: boolean;
  checkout_url?: string;
  error?: string;
}

export interface DeductOrgCreditsRequest {
  orgId: string;
  credits_amount: number;
}

export interface DeductOrgCreditsResponse {
  success: boolean;
  remaining_credits?: number;
  error?: string;
}

export interface OrgCreditTransaction {
  id: string;
  organizationId: string;
  amount: number;
  euroAmount?: number;
  description: string;
  type: 'purchase' | 'usage' | 'refund' | 'bonus';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  transactionId?: string;
  stripePaymentIntentId?: string;
  createdAt: Date;
  updatedAt?: Date;
  metadata?: Record<string, any>;
}