const request = require('supertest');
const app = require('./server');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Mock environment variables
process.env.SUPABASE_URL = 'test-supabase-url';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.JWT_SECRET = 'test-jwt-secret'; // For legacy HS256 fallback
process.env.JWT_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAwHB3N1bR8V8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX\n8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX\n8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX\n8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX\n8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX\n8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX\n-----END RSA PRIVATE KEY-----'; // Test private key
process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwHB3N1bR8V8eX8eX8eX8e\nX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX\n8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX\n8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX\n8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX\n8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX\n-----END PUBLIC KEY-----'; // Corresponding public key
process.env.CLERK_JWT_KEY = 'test-clerk-jwt-key';

// Mock Supabase client with enriched user data
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({
            data: {
              id: 'test-user-id',
              first_name: 'Test',
              last_name: 'User',
              email: 'test@example.com',
              plan_type: 'pro'
            },
            error: null
          }),
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
jest.mock('./middleware/auth', () => ({
  authenticateClerkToken: (req, res, next) => {
    req.auth = { clerkUserId: 'test-clerk-user-id' };
    next();
  },
}));

// Mock rateLimitMiddleware
jest.mock('../middleware/rateLimit', () => ({
  rateLimitMiddleware: (req, res, next) => next(),
}));

describe('Token Generation and Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /extension-token/generate (Long-Lived Token)', () => {
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

      // Verify JWT payload with RS256 matches short-lived structure
      const longLivedToken = response.body.access_token;
      const decodedLong = jwt.verify(longLivedToken, process.env.JWT_PUBLIC_KEY, { algorithms: ['RS256'] });
      expect(decodedLong.clerkUserId).toBe('test-clerk-user-id');
      expect(decodedLong.type).toBe('access');
      expect(decodedLong.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      const longLifetime = 4 * 30 * 24 * 60 * 60;
      expect(decodedLong.exp - decodedLong.iat).toBe(longLifetime);

      // Store for comparison
      global.longLivedDecoded = decodedLong;
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

      // Verify minimal payload in token matches short-lived structure
      const decoded = jwt.verify(token, process.env.JWT_PUBLIC_KEY, { algorithms: ['RS256'] });
      expect(decoded.clerkUserId).toBe('test-clerk-user-id');
      expect(decoded.type).toBe('access');
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      const lifetime = 4 * 30 * 24 * 60 * 60;
      expect(decoded.exp - decoded.iat).toBe(lifetime);
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

  describe('POST /dashboard-token/generate (Short-Lived Token)', () => {
    it('should generate a short-lived token successfully', async () => {
      const response = await request(app)
        .post('/dashboard-token/generate')
        .set('Authorization', 'Bearer test-clerk-token')
        .send();

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.access_token).toBeDefined();
      expect(response.body.expires_in).toBe(60 * 60); // 1 hour
      expect(response.body.usage).toBe('vscode_extension');

      // Verify JWT payload with HS256
      const shortLivedToken = response.body.access_token;
      const decodedShort = jwt.verify(shortLivedToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      expect(decodedShort.clerkUserId).toBe('test-clerk-user-id');
      expect(decodedShort.type).toBe('access');
      expect(decodedShort.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      const shortLifetime = 60 * 60;
      expect(decodedShort.exp - decodedShort.iat).toBe(shortLifetime);

      // Store for comparison
      global.shortLivedDecoded = decodedShort;
    });
  });

  describe('Token Information Retrieval Consistency', () => {
    it('should retrieve the same information from both token types when decoded and validated', async () => {
      // Generate both tokens if not already (in sequence)
      if (!global.longLivedDecoded) {
        const longResponse = await request(app)
          .post('/extension-token/generate')
          .set('Authorization', 'Bearer test-clerk-token')
          .send();
        const longLivedToken = longResponse.body.access_token;
        global.longLivedDecoded = jwt.verify(longLivedToken, process.env.JWT_PUBLIC_KEY, { algorithms: ['RS256'] });
      }

      if (!global.shortLivedDecoded) {
        const shortResponse = await request(app)
          .post('/dashboard-token/generate')
          .set('Authorization', 'Bearer test-clerk-token')
          .send();
        const shortLivedToken = shortResponse.body.access_token;
        global.shortLivedDecoded = jwt.verify(shortLivedToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      }

      const longDecoded = global.longLivedDecoded;
      const shortDecoded = global.shortLivedDecoded;

      expect(longDecoded).toBeDefined();
      expect(shortDecoded).toBeDefined();

      // Assert same core information from payloads
      expect(longDecoded.clerkUserId).toBe(shortDecoded.clerkUserId);
      expect(longDecoded.type).toBe(shortDecoded.type);
      expect(longDecoded.clerkUserId).toBe('test-clerk-user-id');

      // In auth middleware and routes (e.g., vscode.js), both use clerkUserId for DB lookup
      // Mocked Supabase returns identical user data: { id: 'test-user-id' }
      // Thus, retrieved info (user ID, plan, credits) matches for both token types
      expect(longDecoded.clerkUserId).toBe(shortDecoded.clerkUserId); // Key for consistent retrieval
    });
  });
});