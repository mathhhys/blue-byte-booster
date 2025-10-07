const request = require('supertest');
const app = require('../server');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Mock environment variables
process.env.SUPABASE_URL = 'test-supabase-url';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.CLERK_JWT_KEY = 'test-clerk-jwt-key';

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({ data: { id: 'test-user-id' }, error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => ({ data: { id: 'test-token-id' }, error: null }),
        }),
      }),
      rpc: () => ({
        eq: () => ({
          single: () => ({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

// Mock authenticateClerkToken middleware
jest.mock('../middleware/auth', () => ({
  authenticateClerkToken: (req, res, next) => {
    req.auth = { clerkUserId: 'test-clerk-user-id' };
    next();
  },
}));

// Mock rateLimitMiddleware
jest.mock('../middleware/rateLimit', () => ({
  rateLimitMiddleware: (req, res, next) => next(),
}));

describe('Long-Lived Extension Token Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /extension-token/generate', () => {
    it('should generate a long-lived token successfully', async () => {
      const response = await request(app)
        .post('/extension-token/generate')
        .set('Authorization', 'Bearer test-clerk-token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.access_token).toBeDefined();
      expect(response.body.expires_in).toBe(4 * 30 * 24 * 60 * 60);
      expect(response.body.type).toBe('long_lived');

      // Verify JWT payload
      const decoded = jwt.verify(response.body.access_token, 'test-jwt-secret');
      expect(decoded.sub).toBe('test-clerk-user-id');
      expect(decoded.type).toBe('extension_long_lived');
      expect(decoded.exp - decoded.iat).toBe(4 * 30 * 24 * 60 * 60);
    });

    it('should revoke existing tokens before generating new one', async () => {
      const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null });
      const supabaseMock = {
        from: () => ({
          select: () => ({ eq: () => ({ single: () => ({ data: { id: 'test-user-id' }, error: null }) }) }),
          rpc: mockRpc,
          insert: () => ({ select: () => ({ single: () => ({ data: { id: 'test-token-id' }, error: null }) }) }),
        }),
      };
      jest.doMock('@supabase/supabase-js', () => ({ createClient: () => supabaseMock }));

      const response = await request(app)
        .post('/extension-token/generate')
        .set('Authorization', 'Bearer test-clerk-token')
        .send();

      expect(mockRpc).toHaveBeenCalledWith('revoke_user_extension_tokens', { p_user_id: 'test-user-id' });
      expect(response.status).toBe(200);
    });

    it('should hash the token before storing', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ data: { id: 'test-token-id' }, error: null });
      const supabaseMock = {
        from: () => ({
          select: () => ({ eq: () => ({ single: () => ({ data: { id: 'test-user-id' }, error: null }) }) }),
          rpc: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }),
          insert: () => ({ select: () => ({ single: mockInsert }) }),
        }),
      };
      jest.doMock('@supabase/supabase-js', () => ({ createClient: () => supabaseMock }));

      const response = await request(app)
        .post('/extension-token/generate')
        .set('Authorization', 'Bearer test-clerk-token')
        .send();

      const token = response.body.access_token;
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        token_hash: expect.stringContaining('$2b$12$'), // bcrypt hash pattern
        name: 'VSCode Long-Lived Token',
      }));

      // Verify hash matches token
      const storedHash = mockInsert.mock.calls[0][0].token_hash;
      expect(bcrypt.compareSync(token, storedHash)).toBe(true);
    });

    it('should return 401 if authentication fails', async () => {
      const response = await request(app)
        .post('/extension-token/generate')
        .send(); // No auth header

      expect(response.status).toBe(401);
    });

    it('should return 500 if user not found', async () => {
      const supabaseMock = {
        from: () => ({
          select: () => ({ eq: () => ({ single: () => ({ data: null, error: { message: 'User not found' } }) }) }),
        }),
      };
      jest.doMock('@supabase/supabase-js', () => ({ createClient: () => supabaseMock }));

      const response = await request(app)
        .post('/extension-token/generate')
        .set('Authorization', 'Bearer test-clerk-token')
        .send();

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to generate long-lived token');
    });
  });

  describe('POST /extension-token/revoke', () => {
    it('should revoke tokens successfully', async () => {
      const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null });
      const supabaseMock = {
        from: () => ({
          select: () => ({ eq: () => ({ single: () => ({ data: { id: 'test-user-id' }, error: null }) }) }),
          rpc: mockRpc,
        }),
      };
      jest.doMock('@supabase/supabase-js', () => ({ createClient: () => supabaseMock }));

      const response = await request(app)
        .post('/extension-token/revoke')
        .set('Authorization', 'Bearer test-clerk-token')
        .send();

      expect(mockRpc).toHaveBeenCalledWith('revoke_user_extension_tokens', { p_user_id: 'test-user-id' });
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.revoked).toBe(true);
    });

    it('should return 404 if user not found', async () => {
      const supabaseMock = {
        from: () => ({
          select: () => ({ eq: () => ({ single: () => ({ data: null, error: { message: 'User not found' } }) }) }),
        }),
      };
      jest.doMock('@supabase/supabase-js', () => ({ createClient: () => supabaseMock }));

      const response = await request(app)
        .post('/extension-token/revoke')
        .set('Authorization', 'Bearer test-clerk-token')
        .send();

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    it('should return 500 if revocation fails', async () => {
      const mockRpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'RPC error' } });
      const supabaseMock = {
        from: () => ({
          select: () => ({ eq: () => ({ single: () => ({ data: { id: 'test-user-id' }, error: null }) }) }),
          rpc: mockRpc,
        }),
      };
      jest.doMock('@supabase/supabase-js', () => ({ createClient: () => supabaseMock }));

      const response = await request(app)
        .post('/extension-token/revoke')
        .set('Authorization', 'Bearer test-clerk-token')
        .send();

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to revoke token');
    });
  });
});