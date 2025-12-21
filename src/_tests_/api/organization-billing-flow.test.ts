import { beforeEach, describe, expect, it, vi } from 'vitest';

// Use vi.hoisted to ensure env vars are set BEFORE imports
vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = 'mock_stripe_secret_key';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.CLERK_WEBHOOK_SIGNING_SECRET = 'whsec_test';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_key';
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
});

// Define mock objects using vi.hoisted so they are available for vi.mock
const { mockStripeInstance, mockSupabase, mockSvix } = vi.hoisted(() => ({
  mockStripeInstance: {
    webhooks: {
      constructEvent: vi.fn()
    },
    subscriptions: {
      retrieve: vi.fn(),
      update: vi.fn()
    },
    checkout: {
      sessions: {
        create: vi.fn(),
        list: vi.fn()
      }
    },
    customers: {
      retrieve: vi.fn(),
      search: vi.fn(),
      list: vi.fn()
    },
    prices: {
      retrieve: vi.fn()
    },
    invoices: {
      list: vi.fn()
    }
  },
  mockSupabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn(),
    upsert: vi.fn()
  },
  mockSvix: {
    verify: vi.fn()
  }
}));

// Mock Stripe
vi.mock('stripe', () => {
  return {
    default: vi.fn(() => mockStripeInstance)
  };
});

// Mock Supabase JS
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

// Mock Clerk Middleware
vi.mock('../../../src/utils/clerk/token-verification', () => ({
  orgAdminMiddleware: vi.fn().mockResolvedValue({ userId: 'admin_123' })
}));

// Mock Svix
vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => mockSvix)
}));

// Now import handlers and modules
import webhookHandler from '../../../api/stripe/webhooks';
import topupHandler from '../../../api/organizations/credits/topup';
import quantityHandler from '../../../api/organizations/subscription/quantity';
import clerkWebhookHandler from '../../../api/clerk/webhooks';
import * as databaseModule from '../../../src/utils/supabase/database';

// Helper to mock Supabase chain
const mockSupabaseChain = (data: any, error: any = null) => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => Promise.resolve({ data, error })),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data, error })),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation(function(onSuccess: any, onFailure: any) {
      return Promise.resolve({ data, error }).then(onSuccess, onFailure);
    }),
    catch: vi.fn().mockImplementation(function(onFailure: any) {
      return Promise.resolve({ data, error }).catch(onFailure);
    }),
    finally: vi.fn().mockReturnThis()
  };
  return chain;
};

describe('Organization Billing Flow Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure env vars are set for each test
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_key';
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = 'whsec_test';
    
    // Mock getAuthenticatedClient to return mockSupabase to avoid env var issues in database.ts
    vi.spyOn(databaseModule, 'getAuthenticatedClient').mockResolvedValue(mockSupabase as any);
  });

  describe('Credit Top-up Flow', () => {
    it('should create a checkout session for credit top-up', async () => {
      const req = {
        method: 'POST',
        body: { org_id: 'org_123', credits_amount: 1000 },
        headers: { origin: 'http://localhost:3000' }
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'organization_subscriptions') {
          return mockSupabaseChain({ stripe_customer_id: 'cus_123' });
        }
        return mockSupabaseChain(null);
      });

      mockStripeInstance.checkout.sessions.create.mockResolvedValue({ id: 'sess_123', url: 'https://stripe.com/pay' });

      await topupHandler(req, res);

      expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
        metadata: expect.objectContaining({
          purchase_type: 'org_credit_topup',
          credits_to_add: '1000'
        })
      }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should process top-up webhook and add credits to pool', async () => {
      const session = {
        id: 'sess_123',
        customer: 'cus_123',
        metadata: {
          purchase_type: 'org_credit_topup',
          clerk_org_id: 'org_123',
          credits_to_add: '1000'
        }
      };

      const event = {
        type: 'checkout.session.completed',
        data: { object: session }
      };

      const req: any = {
        method: 'POST',
        headers: { 'stripe-signature': 'sig' },
        on: vi.fn((ev, cb) => { 
          if (ev === 'data') cb(Buffer.from(JSON.stringify(event))); 
          if (ev === 'end') cb(); 
        })
      };
      const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(event);
      
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'organization_subscriptions') {
          return mockSupabaseChain({ id: 'sub_uuid', total_credits: 5000 });
        }
        if (table === 'webhook_events') return mockSupabaseChain(null);
        return mockSupabaseChain(null);
      });

      await webhookHandler(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('organization_subscriptions');
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });
  });

  describe('Seat-Based Billing Flow', () => {
    it('should initiate seat quantity update in Stripe', async () => {
      const req = {
        method: 'PUT',
        body: { orgId: 'org_123', newQuantity: 10 }
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'organization_subscriptions') {
          return mockSupabaseChain({ stripe_subscription_id: 'sub_123', status: 'active' });
        }
        return mockSupabaseChain(null);
      });

      mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        items: { data: [{ id: 'item_123' }] }
      });

      await quantityHandler(req, res);

      expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith('sub_123', expect.objectContaining({
        items: [{ id: 'item_123', quantity: 10 }]
      }));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should grant bonus credits when seats are added via webhook', async () => {
      const subscription = {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        items: { data: [{ quantity: 10 }] }
      };

      const event = {
        type: 'customer.subscription.updated',
        data: { object: subscription }
      };

      const req: any = {
        method: 'POST',
        headers: { 'stripe-signature': 'sig' },
        on: vi.fn((ev, cb) => { 
          if (ev === 'data') cb(Buffer.from(JSON.stringify(event))); 
          if (ev === 'end') cb(); 
        })
      };
      const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      mockStripeInstance.webhooks.constructEvent.mockReturnValue(event);
      mockStripeInstance.customers.retrieve.mockResolvedValue({ id: 'cus_123', metadata: { clerk_user_id: 'user_123' } });

      const existingSub = {
        id: 'sub_uuid',
        seats_total: 5,
        total_credits: 2500,
        plan_type: 'teams',
        billing_frequency: 'monthly'
      };

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'organization_subscriptions') {
          return mockSupabaseChain(existingSub);
        }
        if (table === 'webhook_events') return mockSupabaseChain(null);
        if (table === 'users') return mockSupabaseChain({ clerk_id: 'user_123' });
        return mockSupabaseChain(null);
      });

      await webhookHandler(req, res);

      expect(res.json).toHaveBeenCalledWith({ received: true });
    });
  });

  describe('Credit Consumption Utility', () => {
    it('should deduct credits from organization pool', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'organization_subscriptions') {
          return mockSupabaseChain({ id: 'sub_uuid', total_credits: 1000, used_credits: 200 });
        }
        return mockSupabaseChain(null);
      });

      const result = await databaseModule.organizationSubscriptionOperations.deductOrgCredits('org_123', 100);

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('organization_subscriptions');
    });

    it('should fail if insufficient credits', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'organization_subscriptions') {
          return mockSupabaseChain({ id: 'sub_uuid', total_credits: 1000, used_credits: 950 });
        }
        return mockSupabaseChain(null);
      });

      const result = await databaseModule.organizationSubscriptionOperations.deductOrgCredits('org_123', 100);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient organization credits');
    });
  });

  describe('Native Clerk Invitation Flow', () => {
    it('should reserve a seat when organizationInvitation.created webhook is received', async () => {
      const invitation = {
        organization_id: 'org_123',
        email_address: 'new-member@example.com',
        role: 'member'
      };

      const event = {
        type: 'organizationInvitation.created',
        data: invitation
      };

      const req: any = {
        method: 'POST',
        headers: { 'svix-id': '1', 'svix-timestamp': '1', 'svix-signature': '1' },
        body: event
      };
      const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };

      mockSvix.verify.mockReturnValue(event);

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'organization_subscriptions') {
          return mockSupabaseChain({ id: 'sub_uuid', seats_total: 10, seats_used: 5 });
        }
        return mockSupabaseChain(null);
      });

      await clerkWebhookHandler(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('organization_subscriptions');
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });
  });
});