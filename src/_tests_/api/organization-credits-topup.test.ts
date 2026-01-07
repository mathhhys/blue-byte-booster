import { POST } from '../../../app/api/organizations/credits/topup/route';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { orgAdminMiddleware } from '../../../src/utils/clerk/token-verification';

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

vi.mock('../../../src/utils/clerk/token-verification', () => ({
  orgAdminMiddleware: vi.fn().mockResolvedValue({ userId: 'user_123' }),
}));

describe('Organization Credits Topup API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the then implementation to default success
    mockSupabase.then.mockImplementation((resolve) => resolve({ data: null, error: null }));
  });

  it('should successfully top up organization credits', async () => {
    const orgData = {
      id: 'org_uuid_123',
      stripe_customer_id: 'cus_123',
      total_credits: 1000,
    };

    mockSupabase.single.mockResolvedValue({ data: orgData, error: null });

    const req = new NextRequest('http://localhost/api/organizations/credits/topup', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org_123', amount: 500 }),
    });

    const response = await POST(req);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({ success: true });

    // Verify Stripe call
    const stripeInstance = new (Stripe as any)();
    expect(stripeInstance.customers.createBalanceTransaction).toHaveBeenCalledWith(
      'cus_123',
      expect.objectContaining({
        amount: 50000,
        currency: 'usd',
      })
    );

    // Verify Supabase transaction log
    expect(mockSupabase.from).toHaveBeenCalledWith('organization_credit_transactions');
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      organization_id: 'org_uuid_123',
      amount: 500,
      transaction_type: 'purchase',
    }));

    // Verify Supabase credit update
    expect(mockSupabase.from).toHaveBeenCalledWith('organizations');
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
      total_credits: 1500,
    }));
  });

  it('should return 404 if organization or billing info is missing', async () => {
    mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    const req = new NextRequest('http://localhost/api/organizations/credits/topup', {
      method: 'POST',
      body: JSON.stringify({ orgId: 'org_123', amount: 500 }),
    });

    const response = await POST(req);
    const result = await response.json();

    expect(response.status).toBe(404);
    expect(result.error).toContain('billing info not found');
  });
});