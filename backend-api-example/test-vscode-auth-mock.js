const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Mock the database operations
const mockDatabase = {
  oauth_codes: new Map(),
  refresh_tokens: new Map(),
  users: new Map()
};

// Create a test version of the server with mocked database
function createTestServer() {
  const app = express();
  app.use(express.json());

  // Mock environment variables
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.CLERK_SECRET_KEY = 'test-clerk-secret';

  // PKCE utility functions (copied from server.js)
  function generateCodeVerifier() {
    return require('crypto').randomBytes(32).toString('base64url');
  }

  function generateCodeChallenge(verifier) {
    return require('crypto').createHash('sha256').update(verifier).digest('base64url');
  }

  function generateState() {
    return require('crypto').randomBytes(16).toString('hex');
  }

  // JWT utility functions
  function generateAccessToken(clerkUserId) {
    return jwt.sign(
      { 
        clerk_user_id: clerkUserId,
        type: 'access'
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  function generateRefreshToken(clerkUserId) {
    return jwt.sign(
      {
        clerk_user_id: clerkUserId,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000), // Add current timestamp to ensure uniqueness
        jti: require('crypto').randomBytes(8).toString('hex') // Add unique identifier
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
  }

  function verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  // Mock Clerk user verification
  function verifyClerkUser(clerkUserId) {
    // In a real implementation, this would verify with Clerk
    return clerkUserId.startsWith('user_') || clerkUserId.includes('test');
  }

  // Routes
  app.get('/api/auth/initiate-vscode-auth', (req, res) => {
    try {
      const { redirect_uri } = req.query;

      if (!redirect_uri) {
        return res.status(400).json({ error: 'redirect_uri is required' });
      }

      const codeVerifier = generateCodeVerifier();
      const codeChallenge = generateCodeChallenge(codeVerifier);
      const state = generateState();

      // Mock storing in database
      mockDatabase.oauth_codes.set(state, {
        code_verifier: codeVerifier,
        code_challenge: codeChallenge,
        redirect_uri,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        created_at: new Date().toISOString()
      });

      res.json({
        success: true,
        code_challenge: codeChallenge,
        state: state,
        clerk_auth_url: `https://your-clerk-domain.clerk.accounts.dev/sign-in?redirect_url=${encodeURIComponent(`${process.env.FRONTEND_URL || 'https://softcodes.ai'}/auth/vscode-callback?state=${state}`)}`
      });
    } catch (error) {
      console.error('Error in initiate-vscode-auth:', error);
      res.status(500).json({ error: 'Failed to initiate authentication' });
    }
  });

  app.post('/api/auth/token', (req, res) => {
    try {
      const { authorization_code, code_verifier, state, clerk_user_id } = req.body;

      if (!authorization_code || !code_verifier || !state || !clerk_user_id) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      // Mock database lookup
      const oauthCode = mockDatabase.oauth_codes.get(state);
      
      if (!oauthCode || new Date(oauthCode.expires_at) < new Date()) {
        return res.status(400).json({ error: 'Invalid or expired authorization code' });
      }

      // Verify code challenge
      const expectedChallenge = generateCodeChallenge(code_verifier);
      if (expectedChallenge !== oauthCode.code_challenge) {
        return res.status(400).json({ error: 'Invalid code verifier' });
      }

      // Verify Clerk user (mock)
      if (!verifyClerkUser(clerk_user_id)) {
        return res.status(400).json({ error: 'Invalid Clerk user' });
      }

      // Generate tokens
      const accessToken = generateAccessToken(clerk_user_id);
      const refreshToken = generateRefreshToken(clerk_user_id);

      // Store refresh token (mock)
      mockDatabase.refresh_tokens.set(refreshToken, {
        clerk_user_id,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        created_at: new Date().toISOString(),
        revoked_at: null
      });

      // Clean up used authorization code
      mockDatabase.oauth_codes.delete(state);

      res.json({
        success: true,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 3600
      });
    } catch (error) {
      console.error('Error in token exchange:', error);
      res.status(500).json({ error: 'Failed to exchange authorization code' });
    }
  });

  app.post('/api/auth/refresh-token', (req, res) => {
    try {
      const { refresh_token } = req.body;

      if (!refresh_token) {
        return res.status(400).json({ error: 'refresh_token is required' });
      }

      // Verify refresh token
      const decoded = verifyToken(refresh_token);
      if (!decoded || decoded.type !== 'refresh') {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Check if token exists and is not revoked (mock)
      const tokenData = mockDatabase.refresh_tokens.get(refresh_token);
      if (!tokenData || tokenData.revoked_at || new Date(tokenData.expires_at) < new Date()) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken(decoded.clerk_user_id);
      const newRefreshToken = generateRefreshToken(decoded.clerk_user_id);

      // Revoke old refresh token and store new one (mock)
      mockDatabase.refresh_tokens.set(refresh_token, {
        ...tokenData,
        revoked_at: new Date().toISOString()
      });

      mockDatabase.refresh_tokens.set(newRefreshToken, {
        clerk_user_id: decoded.clerk_user_id,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        revoked_at: null
      });

      res.json({
        success: true,
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_in: 3600
      });
    } catch (error) {
      console.error('Error in refresh token:', error);
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  });

  return app;
}

// Tests
describe('VSCode Authentication Endpoints (Mock)', () => {
  let app;
  let server;

  beforeAll(async () => {
    app = createTestServer();
    server = app.listen(0); // Use random available port
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    // Clear mock database
    mockDatabase.oauth_codes.clear();
    mockDatabase.refresh_tokens.clear();
    mockDatabase.users.clear();
  });

  test('should initiate VSCode auth flow and store PKCE parameters', async () => {
    const testRedirectUri = 'vscode://publisher.extension/auth-callback';
    
    const res = await request(app)
      .get(`/api/auth/initiate-vscode-auth?redirect_uri=${encodeURIComponent(testRedirectUri)}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.code_challenge).toBeDefined();
    expect(res.body.state).toBeDefined();
    expect(res.body.clerk_auth_url).toBeDefined();
    expect(res.body.clerk_auth_url).toContain('clerk.accounts.dev');
  });

  test('should return 400 when redirect_uri is missing', async () => {
    const res = await request(app)
      .get('/api/auth/initiate-vscode-auth');

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('redirect_uri is required');
  });

  test('should exchange authorization code for access and refresh tokens', async () => {
    // First, initiate auth to get state and code_challenge
    const testRedirectUri = 'vscode://publisher.extension/auth-callback';
    const initRes = await request(app)
      .get(`/api/auth/initiate-vscode-auth?redirect_uri=${encodeURIComponent(testRedirectUri)}`);

    const { state, code_challenge } = initRes.body;
    
    // Generate code_verifier that matches the code_challenge
    const crypto = require('crypto');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    // Update mock database with correct code_verifier
    const oauthData = mockDatabase.oauth_codes.get(state);
    mockDatabase.oauth_codes.set(state, {
      ...oauthData,
      code_verifier: codeVerifier,
      code_challenge: crypto.createHash('sha256').update(codeVerifier).digest('base64url')
    });

    const res = await request(app)
      .post('/api/auth/token')
      .send({
        authorization_code: 'test_auth_code_123',
        code_verifier: codeVerifier,
        state: state,
        clerk_user_id: 'user_test_123'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
    expect(res.body.expires_in).toEqual(3600);
  });

  test('should return 400 for invalid state', async () => {
    const res = await request(app)
      .post('/api/auth/token')
      .send({
        authorization_code: 'test_auth_code_123',
        code_verifier: 'test_verifier',
        state: 'invalid-state',
        clerk_user_id: 'user_test_123'
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Invalid or expired authorization code');
  });

  test('should return 400 for code_challenge mismatch', async () => {
    // First, initiate auth
    const testRedirectUri = 'vscode://publisher.extension/auth-callback';
    const initRes = await request(app)
      .get(`/api/auth/initiate-vscode-auth?redirect_uri=${encodeURIComponent(testRedirectUri)}`);

    const { state } = initRes.body;

    const res = await request(app)
      .post('/api/auth/token')
      .send({
        authorization_code: 'test_auth_code_123',
        code_verifier: 'wrong_verifier',
        state: state,
        clerk_user_id: 'user_test_123'
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Invalid code verifier');
  });

  test('should refresh access token using a valid refresh token', async () => {
    // First, get tokens through the normal flow
    const testRedirectUri = 'vscode://publisher.extension/auth-callback';
    const initRes = await request(app)
      .get(`/api/auth/initiate-vscode-auth?redirect_uri=${encodeURIComponent(testRedirectUri)}`);

    const { state } = initRes.body;
    
    const crypto = require('crypto');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    const oauthData = mockDatabase.oauth_codes.get(state);
    mockDatabase.oauth_codes.set(state, {
      ...oauthData,
      code_verifier: codeVerifier,
      code_challenge: crypto.createHash('sha256').update(codeVerifier).digest('base64url')
    });

    const tokenRes = await request(app)
      .post('/api/auth/token')
      .send({
        authorization_code: 'test_auth_code_123',
        code_verifier: codeVerifier,
        state: state,
        clerk_user_id: 'user_test_123'
      });

    expect(tokenRes.statusCode).toEqual(200);
    const oldRefreshToken = tokenRes.body.refresh_token;

    // Now, use the refresh token to get a new access token
    const refreshRes = await request(app)
      .post('/api/auth/refresh-token')
      .send({
        refresh_token: oldRefreshToken
      });

    expect(refreshRes.statusCode).toEqual(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.access_token).toBeDefined();
    expect(refreshRes.body.refresh_token).toBeDefined();
    expect(refreshRes.body.refresh_token).not.toEqual(oldRefreshToken); // Should be a new token
  });

  test('should return 401 for invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send({
        refresh_token: 'invalid_refresh_token'
      });

    expect(res.statusCode).toEqual(401);
    expect(res.body.error).toEqual('Invalid refresh token');
  });

  test('should return 401 for a revoked refresh token', async () => {
    // First, get a valid refresh token
    const testRedirectUri = 'vscode://publisher.extension/auth-callback';
    const initRes = await request(app)
      .get(`/api/auth/initiate-vscode-auth?redirect_uri=${encodeURIComponent(testRedirectUri)}`);

    const { state } = initRes.body;
    
    const crypto = require('crypto');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    const oauthData = mockDatabase.oauth_codes.get(state);
    mockDatabase.oauth_codes.set(state, {
      ...oauthData,
      code_verifier: codeVerifier,
      code_challenge: crypto.createHash('sha256').update(codeVerifier).digest('base64url')
    });

    const tokenRes = await request(app)
      .post('/api/auth/token')
      .send({
        authorization_code: 'test_auth_code_123',
        code_verifier: codeVerifier,
        state: state,
        clerk_user_id: 'user_test_123'
      });

    expect(tokenRes.statusCode).toEqual(200);
    const refreshTokenToRevoke = tokenRes.body.refresh_token;

    // Manually revoke the token
    const tokenData = mockDatabase.refresh_tokens.get(refreshTokenToRevoke);
    mockDatabase.refresh_tokens.set(refreshTokenToRevoke, {
      ...tokenData,
      revoked_at: new Date().toISOString()
    });

    // Try to use the revoked token
    const refreshRes = await request(app)
      .post('/api/auth/refresh-token')
      .send({
        refresh_token: refreshTokenToRevoke
      });

    expect(refreshRes.statusCode).toEqual(401);
    expect(refreshRes.body.error).toEqual('Invalid refresh token');
  });

  test('should return 401 for an expired refresh token', async () => {
    const clerkUserId = 'user_test_expired';
    
    // Create an expired refresh token
    const expiredToken = jwt.sign(
      { 
        clerk_user_id: clerkUserId,
        type: 'refresh'
      },
      process.env.JWT_SECRET,
      { expiresIn: '-1h' } // Already expired
    );

    // Add to mock database as expired
    mockDatabase.refresh_tokens.set(expiredToken, {
      clerk_user_id: clerkUserId,
      expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      created_at: new Date().toISOString(),
      revoked_at: null
    });

    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send({
        refresh_token: expiredToken
      });

    expect(res.statusCode).toEqual(401);
    expect(res.body.error).toEqual('Invalid refresh token');
  });
});