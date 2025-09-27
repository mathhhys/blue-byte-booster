import handler from '../../api/clerk/webhooks';
import { createClient } from '@supabase/supabase-js';
import { Webhook } from 'svix';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue({ error: null }),
  }),
}));

jest.mock('svix', () => ({
  Webhook: jest.fn().mockImplementation(() => ({
    verify: jest.fn(),
  })),
}));

describe('Clerk Webhook Handler', () => {
  let req: any, res: any;
  const mockSupabase = createClient('', '');

  beforeEach(() => {
    req = {
      method: 'POST',
      headers: {
        'svix-id': 'test-id',
        'svix-timestamp': 'test-timestamp',
        'svix-signature': 'test-signature',
      },
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    (Webhook as any as jest.Mock).mockClear();
    (mockSupabase.from as any as jest.Mock).mockClear();
    ((mockSupabase as any).upsert as jest.Mock).mockClear();
    ((mockSupabase as any).update as jest.Mock).mockClear();
    ((mockSupabase as any).delete as jest.Mock).mockClear();
  });

  it('should handle user.created event', async () => {
    const payload = {
      type: 'user.created',
      data: {
        id: 'user_123',
        email_addresses: [{ email_address: 'test@example.com' }],
        first_name: 'Test',
        last_name: 'User',
        image_url: 'http://example.com/avatar.png',
      },
    };
    req.body = payload;
    (Webhook as any as jest.Mock).mockReturnValue({
      verify: jest.fn().mockReturnValue(payload),
    });

    await handler(req, res);

    expect(mockSupabase.from).toHaveBeenCalledWith('users');
    expect((mockSupabase as any).upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        clerk_id: 'user_123',
        email: 'test@example.com',
      }),
      { onConflict: 'clerk_id' }
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle user.updated event', async () => {
    const payload = {
      type: 'user.updated',
      data: {
        id: 'user_123',
        email_addresses: [{ email_address: 'updated@example.com' }],
      },
    };
    req.body = payload;
    (new (Webhook as any)('').verify as jest.Mock).mockReturnValue(payload);

    await handler(req, res);

    expect(mockSupabase.from).toHaveBeenCalledWith('users');
    expect((mockSupabase as any).update).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle user.deleted event', async () => {
    const payload = {
      type: 'user.deleted',
      data: {
        id: 'user_123',
      },
    };
    req.body = payload;
    (new (Webhook as any)('').verify as jest.Mock).mockReturnValue(payload);

    await handler(req, res);

    expect(mockSupabase.from).toHaveBeenCalledWith('users');
    expect((mockSupabase as any).delete).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});