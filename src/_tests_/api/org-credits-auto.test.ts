import { createClient } from '@supabase/supabase-js';
import handler from '../../../api/stripe/webhooks';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Stripe and Supabase
const mockStripe = {
  webhooks: {
    constructEvent: vi.fn()
  },
  subscriptions: {
    retrieve: vi.fn()
  },
  invoices: {
    list: vi.fn()
  },
  customers: {
    retrieve: vi.fn()
  },
  checkout: {
    sessions: {
      list: vi.fn()
    }
  }
};

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => mockStripe)
  };
});

const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn()
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

// Helper to mock Supabase chain
const mockSupabaseChain = (data: any, error: any = null) => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => Promise.resolve({ data, error })),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data, error })),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    // Handle cases where the chain is awaited directly
    then: vi.fn().mockImplementation((resolve) => resolve({ data, error }))
  };
  return chain;
};

describe('Organization Credits Auto-Assignment', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_key';

    req = {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_test' },
      on: vi.fn((event, callback) => {
        if (event === 'data') callback(Buffer.from(JSON.stringify({ id: 'evt_test' })));
        if (event === 'end') callback();
      })
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    vi.clearAllMocks();
  });

  it('should grant credits to organizations table on subscription renewal', async () => {
    const invoice = {
      id: 'in_123',
      subscription: 'sub_123',
      billing_reason: 'subscription_cycle',
      lines: { data: [] }
    };

    const event = {
      type: 'invoice.payment_succeeded',
      data: { object: invoice }
    };

    mockStripe.webhooks.constructEvent.mockReturnValue(event);
    mockStripe.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_123',
      customer: 'cus_123',
      metadata: { plan_type: 'teams', seats: '5' },
      items: { data: [{ price: { recurring: { interval: 'month' } } }] }
    });
    mockStripe.invoices.list.mockResolvedValue({
      data: [{ id: 'in_old', created: 1000, status: 'paid' }, { id: 'in_123', created: 2000, status: 'paid' }]
    });

    const orgSubscription = {
      id: 'org_sub_123',
      clerk_org_id: 'org_123',
      seats_total: 5,
      plan_type: 'teams',
      billing_frequency: 'monthly'
    };

    const orgData = {
      id: 'org_123_uuid',
      total_credits: 1000
    };

    const orgChain = mockSupabaseChain(orgData);
    const subChain = mockSupabaseChain(orgSubscription);
    const webhookChain = mockSupabaseChain(null);

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'organization_subscriptions') return subChain;
      if (table === 'organizations') return orgChain;
      if (table === 'webhook_events') return webhookChain;
      return mockSupabaseChain(null);
    });

    await handler(req, res);

    // Verify response
    expect(res.json).toHaveBeenCalledWith({ received: true });

    // Verify organizations table was updated
    expect(mockSupabase.from).toHaveBeenCalledWith('organizations');
    
    // Verify the update call to organizations
    expect(orgChain.update).toHaveBeenCalledWith(expect.objectContaining({
      total_credits: 3500
    }));
  });
});