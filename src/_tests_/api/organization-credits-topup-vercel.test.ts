import handler from '../../../api/organizations/credits/topup';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Stripe from 'stripe';

// Mock dependencies
vi.mock('stripe', () => {
  const mockStripe = {
    customers: {
      createBalanceTransaction: vi.fn().mockResolvedValue({}),
    },
  };
  return {
    default: vi.fn().mockImplementation(() => mockStripe),
  };
});

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  then: vi.fn().mockImplementation((resolve) => resolve({ data: null, error: null })),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('../../../src/utils/clerk/token-verification.js', () => ({
  orgAdminMiddleware: vi.fn().mockResolvedValue({ userId: 'user_123' }),
}));

describe('Organization Credits Topup API (Vercel Function)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.then.mockImplementation((resolve) => resolve({ data: null, error: null }));
    process.env.STRIPE_SECRET_KEY = '';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_key';
  });

  it('should successfully top up organization credits', async () => {
    const orgData = {
      id: 'org_uuid_123',
      stripe_customer_id: 'cus_123',
      total_credits: 1000,
    };

    mockSupabase.single.mockResolvedValue({ data: orgData, error: null });

    const req = {
      method: 'POST',
      body: { orgId: 'org_123', amount: 500 },
      headers: { authorization: 'Bearer token' },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });

    // Verify Stripe call
    const stripeInstance = new (Stripe as any)();
    expect(stripeInstance.customers.createBalanceTransaction).toHaveBeenCalledWith(
      'cus_123',
      expect.objectContaining({
        amount: 50000,
        currency: 'usd',
      })
    );
  });

  it('should return 404 if organization or billing info is missing', async () => {
    mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const req = {
      method: 'POST',
      body: { orgId: 'org_123', amount: 500 },
      headers: { authorization: 'Bearer token' },
    } as any;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('billing info not found')
    }));
  });
});