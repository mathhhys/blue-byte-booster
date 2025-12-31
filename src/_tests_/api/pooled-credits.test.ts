import { creditOperations } from '../../utils/supabase/database';

// Mock Supabase client
const mockSupabase = {
  rpc: jest.fn()
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

// Mock environment variables
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_key';

describe('Pooled Credit Deduction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should deduct from organization pool when orgId is provided', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

    const result = await creditOperations.deductCredits(
      'user_123',
      100,
      'Test usage',
      'ref_123',
      'org_123'
    );

    expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_credits_pooled', {
      p_clerk_user_id: 'user_123',
      p_amount: 100,
      p_clerk_org_id: 'org_123',
      p_description: 'Test usage',
      p_reference_id: 'ref_123'
    });
    expect(result.success).toBe(true);
  });

  it('should deduct from personal pool when orgId is not provided', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: true, error: null });

    const result = await creditOperations.deductCredits(
      'user_123',
      50,
      'Personal usage'
    );

    expect(mockSupabase.rpc).toHaveBeenCalledWith('deduct_credits_pooled', {
      p_clerk_user_id: 'user_123',
      p_amount: 50,
      p_clerk_org_id: null,
      p_description: 'Personal usage',
      p_reference_id: null
    });
    expect(result.success).toBe(true);
  });

  it('should return failure when credits are insufficient', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: false, error: null });

    const result = await creditOperations.deductCredits(
      'user_123',
      10000,
      'Expensive usage',
      undefined,
      'org_123'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient credits');
  });

  it('should handle RPC errors gracefully', async () => {
    const mockError = { message: 'Database connection failed' };
    mockSupabase.rpc.mockResolvedValue({ data: null, error: mockError });

    const result = await creditOperations.deductCredits(
      'user_123',
      10,
      'Usage'
    );

    expect(result.success).toBe(false);
    expect(result.error).toEqual(mockError);
  });
});