import handler from '../../../api/organizations/seats/assign';
import { organizationSeatOperations } from '../../../src/utils/supabase/database';
import { orgAdminMiddleware } from '../../../src/utils/clerk/token-verification';
import Stripe from 'stripe';

// Mock dependencies
jest.mock('../../../src/utils/supabase/database', () => ({
  organizationSeatOperations: {
    assignSeat: jest.fn()
  }
}));

jest.mock('../../../src/utils/clerk/token-verification', () => ({
  orgAdminMiddleware: jest.fn()
}));

jest.mock('stripe');

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      upsert: jest.fn(() => Promise.resolve({ error: null }))
    }))
  }))
}));

describe('Assign Seat API', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    req = {
      method: 'POST',
      body: {
        orgId: 'org_123',
        email: 'test@example.com',
        role: 'member'
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock successful auth
    (orgAdminMiddleware as jest.Mock).mockResolvedValue({ userId: 'user_123' });
  });

  it('should assign seat successfully when subscription exists', async () => {
    // Mock successful assignment
    (organizationSeatOperations.assignSeat as jest.Mock).mockResolvedValue({
      data: { id: 'seat_123' },
      error: null
    });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Seat assigned successfully'
    }));
  });

  it('should sync from Stripe and retry when subscription is missing', async () => {
    // Mock first assignment failure
    (organizationSeatOperations.assignSeat as jest.Mock)
      .mockResolvedValueOnce({
        data: null,
        error: 'Organization subscription not found'
      })
      .mockResolvedValueOnce({ // Mock second assignment success
        data: { id: 'seat_123' },
        error: null
      });

    // Get the mock instance
    const stripeInstance = (Stripe as unknown as jest.Mock).mock.instances[0];
    
    // Mock Stripe responses
    stripeInstance.customers.search.mockResolvedValue({
      data: [{ id: 'cus_123' }]
    });
    
    stripeInstance.subscriptions.list.mockResolvedValue({
      data: [{
        id: 'sub_123',
        metadata: { seats: '5' },
        items: { data: [{ quantity: 5 }] },
        current_period_start: 1234567890,
        current_period_end: 1234567890
      }]
    });

    await handler(req, res);

    // Should have called Stripe
    expect(stripeInstance.customers.search).toHaveBeenCalled();
    expect(stripeInstance.subscriptions.list).toHaveBeenCalled();
    
    // Should have retried assignment
    expect(organizationSeatOperations.assignSeat).toHaveBeenCalledTimes(2);
    
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('should fail if sync fails', async () => {
    // Mock assignment failure
    (organizationSeatOperations.assignSeat as jest.Mock).mockResolvedValue({
      data: null,
      error: 'Organization subscription not found'
    });

    // Get the mock instance
    const stripeInstance = (Stripe as unknown as jest.Mock).mock.instances[0];

    // Mock Stripe returning no customer
    stripeInstance.customers.search.mockResolvedValue({
      data: []
    });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Subscription not found'
    }));
  });

  it('should return 402 when no seats available', async () => {
    (organizationSeatOperations.assignSeat as jest.Mock).mockResolvedValue({
      data: null,
      error: 'No available seats. Please upgrade your plan.'
    });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Insufficient seats'
    }));
  });

  it('should return 400 when user already has a seat', async () => {
    (organizationSeatOperations.assignSeat as jest.Mock).mockResolvedValue({
      data: null,
      error: 'User already has a reserved or active seat in this organization'
    });

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'User already has a reserved or active seat'
    }));
  });

  it('should return 400 when missing parameters', async () => {
    req.body = {}; // Empty body
    
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Organization ID and user email are required'
    }));
  });
});