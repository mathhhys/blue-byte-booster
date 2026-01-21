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