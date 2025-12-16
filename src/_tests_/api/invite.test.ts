import handler from '../../../api/organizations/invite';
import { organizationSeatOperations } from '../../../src/utils/supabase/database';
import { orgAdminMiddleware } from '../../../src/utils/clerk/token-verification';
import Stripe from 'stripe';

// Mock dependencies
jest.mock('../../../src/utils/supabase/database', () => ({
  organizationSeatOperations: {
    assignSeat: jest.fn(),
    releaseSeatByEmail: jest.fn()
  }
}));

jest.mock('../../../src/utils/clerk/token-verification', () => ({
  orgAdminMiddleware: jest.fn()
}));

const mockCreateOrganizationInvitation = jest.fn();

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(() => ({
    organizations: {
      createOrganizationInvitation: mockCreateOrganizationInvitation
    }
  }))
}));

jest.mock('stripe');

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      upsert: jest.fn(() => Promise.resolve({ error: null }))
    }))
  }))
}));

describe('Invite API', () => {
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
    
    // Mock successful Clerk invitation
    mockCreateOrganizationInvitation.mockResolvedValue({
      id: 'inv_123',
      emailAddress: 'test@example.com',
      role: 'basic_member',
      status: 'pending',
      createdAt: Date.now()
    });
  });

  it('should reserve seat and create invitation successfully', async () => {
    // Mock successful seat reservation
    (organizationSeatOperations.assignSeat as jest.Mock).mockResolvedValue({
      data: { id: 'seat_123' },
      error: null
    });

    await handler(req, res);

    expect(organizationSeatOperations.assignSeat).toHaveBeenCalledWith('org_123', 'test@example.com', 'member');
    expect(mockCreateOrganizationInvitation).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org_123',
      emailAddress: 'test@example.com'
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      invitation: expect.objectContaining({ id: 'inv_123' })
    }));
  });

  it('should rollback seat reservation if Clerk invitation fails', async () => {
    // Mock successful seat reservation
    (organizationSeatOperations.assignSeat as jest.Mock).mockResolvedValue({
      data: { id: 'seat_123' },
      error: null
    });

    // Mock Clerk failure
    mockCreateOrganizationInvitation.mockRejectedValue(new Error('Clerk error'));

    // Mock rollback success
    (organizationSeatOperations.releaseSeatByEmail as jest.Mock).mockResolvedValue({
      data: { id: 'seat_123', status: 'revoked' },
      error: null
    });

    await handler(req, res);

    expect(organizationSeatOperations.releaseSeatByEmail).toHaveBeenCalledWith('org_123', 'test@example.com', 'invite_failed');
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('should proceed if seat is already reserved (idempotent)', async () => {
    // Mock seat already reserved
    (organizationSeatOperations.assignSeat as jest.Mock).mockResolvedValue({
      data: null,
      error: 'User already has a reserved or active seat in this organization'
    });

    await handler(req, res);

    // Should still try to create invitation
    expect(mockCreateOrganizationInvitation).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should return 402 if no seats available', async () => {
    (organizationSeatOperations.assignSeat as jest.Mock).mockResolvedValue({
      data: null,
      error: 'No available seats. Please upgrade your plan.'
    });

    await handler(req, res);

    expect(mockCreateOrganizationInvitation).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(402);
  });
});