export interface OrgAnalytics {
  total_requests: number;
  total_credits: number;
  total_input_tokens: number;
  total_output_tokens: number;
  top_models: Array<{
    model_id: string;
    cost: number;
    requests: number;
  }>;
}

export interface UserAnalytics {
  user_id: string;
  email?: string;
  name?: string;
  total_requests: number;
  total_credits: number;
  total_input_tokens: number;
  total_output_tokens: number;
  last_active: string;
}
export interface MonthlyOrgAnalytics {
  id: string;
  organization_id: string;
  year_month: string;
  total_credits_used: number;
  total_usd_spent: number;
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  seat_count: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlySeatAnalytics {
  id: string;
  organization_id: string;
  user_id: string;
  year_month: string;
  total_credits_used: number;
  total_usd_spent: number;
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  users?: {
    clerk_id: string;
    email?: string;
    name?: string;
  };
}

export interface MonthlyOrgModelUsage {
  id: string;
  organization_id: string;
  model_id: string;
  provider: string;
  year_month: string;
  total_credits_used: number;
  total_usd_spent: number;
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  created_at: string;
  updated_at: string;
}