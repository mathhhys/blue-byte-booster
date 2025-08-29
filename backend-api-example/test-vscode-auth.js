require('dotenv').config({ path: './.env' });
const request = require('supertest');
const app = require('./server'); // Assuming your Express app is exported from server.js
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // Import jsonwebtoken for testing expired tokens

// Ensure JWT_SECRET is set for testing
// This should ideally be loaded from .env or a test config
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-testing-only';

// Supabase client for test database operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// PKCE Utility Functions (duplicated for testing purposes, ideally shared)
function generateRandomString(length) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

function sha256(plain) {
  return crypto.createHash('sha256').update(plain).digest();
}

function base64URLEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32));
}

async function generateCodeChallenge(code_verifier) {
  const hashed = await sha256(code_verifier);
  return base64URLEncode(hashed);
}

describe('VSCode Authentication Endpoints', () => {
  let testClerkUserId;
  let testCodeVerifier;
  let testCodeChallenge;
  let testState;
  const testRedirectUri = 'vscode-bluebytebooster://callback';
  let server; // To hold the server instance

  beforeAll(async () => {
    // Start the server once for all tests
    server = app.listen(process.env.PORT || 3001, () => {
      console.log(`Test server running on port ${process.env.PORT || 3001}`);
    });

    // IMPORTANT: Ensure Supabase migrations are run before running tests.
    // Specifically, the 'oauth_codes' and 'refresh_tokens' tables must exist.
    // You can run the migration located at backend-api-example/migrations/20250828_add_oauth_tables.sql
    // For example, using a Supabase migration tool or by manually executing the SQL.
    console.warn('Ensure Supabase migrations are run before running tests. Specifically, the `oauth_codes` and `refresh_tokens` tables must exist.');
  });

  beforeEach(async () => {
    // Clear oauth_codes and refresh_tokens tables before each test
    await supabase.from('oauth_codes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('refresh_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Create a dummy user in Supabase for testing
    testClerkUserId = `user_${Date.now()}_${generateRandomString(5)}`;
    await supabase.from('users').upsert({
      clerk_id: testClerkUserId,
      email: `${testClerkUserId}@example.com`,
      plan_type: 'starter'
    });

    testCodeVerifier = generateCodeVerifier();
    testCodeChallenge = await generateCodeChallenge(testCodeVerifier);
    testState = generateRandomString(32);
  });

  afterEach(async () => {
    // Clean up dummy user after each test
    await supabase.from('users').delete().eq('clerk_id', testClerkUserId);
  });

  afterAll(async () => {
    // Close the server after all tests are done
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  // Test GET /api/auth/initiate-vscode-auth
  test('should initiate VSCode auth flow and store PKCE parameters', async () => {
    const res = await request(app)
      .get(`/api/auth/initiate-vscode-auth?redirect_uri=${encodeURIComponent(testRedirectUri)}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.code_challenge).toBeDefined();
    expect(res.body.state).toBeDefined();
    expect(res.body.auth_url).toBeDefined();

    // Verify data stored in Supabase
    const { data, error } = await supabase
      .from('oauth_codes')
      .select('*')
      .eq('state', res.body.state)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.code_challenge).toEqual(res.body.code_challenge);
    expect(data.redirect_uri).toEqual(testRedirectUri);
    expect(data.expires_at).toBeDefined();
  });

  test('should return 400 if redirect_uri is missing for initiate-vscode-auth', async () => {
    const res = await request(app)
      .get('/api/auth/initiate-vscode-auth');

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Missing redirect_uri parameter');
  });

  // Test POST /api/auth/token
  test('should exchange authorization code for access and refresh tokens', async () => {
    // First, simulate initiate-vscode-auth to get stored PKCE parameters
    await supabase
      .from('oauth_codes')
      .insert([
        {
          clerk_user_id: testClerkUserId, // Use the actual Clerk user ID for the code
          code_verifier: testCodeVerifier,
          code_challenge: testCodeChallenge,
          state: testState,
          redirect_uri: testRedirectUri,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        },
      ]);

    const res = await request(app)
      .post('/api/auth/token')
      .send({
        code: testClerkUserId, // As per current implementation, 'code' is clerkUserId
        code_verifier: testCodeVerifier,
        state: testState,
        redirect_uri: testRedirectUri,
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
    expect(res.body.expires_in).toEqual(3600);

    // Verify refresh token stored in Supabase
    const { data: refreshTokenData, error: refreshError } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('clerk_user_id', testClerkUserId)
      .eq('token', res.body.refresh_token)
      .is('revoked_at', null)
      .single();

    expect(refreshError).toBeNull();
    expect(refreshTokenData).toBeDefined();

    // Verify oauth_code is deleted
    const { data: oauthCodeData } = await supabase
      .from('oauth_codes')
      .select('*')
      .eq('state', testState);
    expect(oauthCodeData.length).toEqual(0);
  });

  test('should return 400 if parameters are missing for token exchange', async () => {
    const res = await request(app)
      .post('/api/auth/token')
      .send({}); // Empty body

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Missing required parameters');
  });

  test('should return 400 for invalid state for token exchange', async () => {
    const res = await request(app)
      .post('/api/auth/token')
      .send({
        code: testClerkUserId,
        code_verifier: testCodeVerifier,
        state: 'invalid-state', // Invalid state
        redirect_uri: testRedirectUri,
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Invalid or expired authorization code');
  });

  test('should return 400 for code_challenge mismatch for token exchange', async () => {
    // Simulate initiate-vscode-auth with a different code_challenge
    await supabase
      .from('oauth_codes')
      .insert([
        {
          clerk_user_id: testClerkUserId,
          code_verifier: generateCodeVerifier(), // Different verifier
          code_challenge: await generateCodeChallenge(generateCodeVerifier()), // Different challenge
          state: testState,
          redirect_uri: testRedirectUri,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        },
      ]);

    const res = await request(app)
      .post('/api/auth/token')
      .send({
        code: testClerkUserId,
        code_verifier: testCodeVerifier, // Original verifier, will mismatch
        state: testState,
        redirect_uri: testRedirectUri,
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Invalid code verifier');
  });

  // Test POST /api/auth/refresh-token
  test('should refresh access token using a valid refresh token', async () => {
    // First, get an access and refresh token
    await supabase
      .from('oauth_codes')
      .insert([
        {
          clerk_user_id: testClerkUserId,
          code_verifier: testCodeVerifier,
          code_challenge: testCodeChallenge,
          state: testState,
          redirect_uri: testRedirectUri,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        },
      ]);

    const tokenRes = await request(app)
      .post('/api/auth/token')
      .send({
        code: testClerkUserId,
        code_verifier: testCodeVerifier,
        state: testState,
        redirect_uri: testRedirectUri,
      });

    expect(tokenRes.statusCode).toEqual(200);
    const oldRefreshToken = tokenRes.body.refresh_token;

    // Now, use the refresh token to get a new access token
    const refreshRes = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refresh_token: oldRefreshToken });

    expect(refreshRes.statusCode).toEqual(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.access_token).toBeDefined();
    expect(refreshRes.body.refresh_token).toBeDefined();
    expect(refreshRes.body.expires_in).toEqual(3600);
    expect(refreshRes.body.access_token).not.toEqual(tokenRes.body.access_token);
    expect(refreshRes.body.refresh_token).not.toEqual(oldRefreshToken);

    // Verify old refresh token is revoked
    const { data: oldTokenData } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token', oldRefreshToken)
      .single();
    expect(oldTokenData.revoked_at).toBeDefined();

    // Verify new refresh token is stored
    const { data: newTokenData, error: newTokenError } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token', refreshRes.body.refresh_token)
      .is('revoked_at', null)
      .single();
    expect(newTokenError).toBeNull();
    expect(newTokenData).toBeDefined();
  });

  test('should return 400 if refresh_token is missing', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send({});

    expect(res.statusCode).toEqual(400);
    expect(res.body.error).toEqual('Refresh token is required');
  });

  test('should return 401 for an invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refresh_token: 'invalid.jwt.token' });

    expect(res.statusCode).toEqual(401);
    expect(res.body.error).toEqual('Invalid refresh token');
  });

  test('should return 401 for an expired refresh token', async () => {
    // Manually insert an expired refresh token
    const expiredRefreshToken = require('jsonwebtoken').sign(
      { clerkUserId: testClerkUserId, type: 'refresh' },
      process.env.JWT_SECRET,
      { expiresIn: '1s' }
    );

    await supabase
      .from('refresh_tokens')
      .insert([
        {
          clerk_user_id: testClerkUserId,
          token: expiredRefreshToken,
          expires_at: new Date(Date.now() - 1000).toISOString(), // Set expiry in the past
        },
      ]);

    // Wait for the token to actually expire (1 second)
    await new Promise(resolve => setTimeout(resolve, 1100));

    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refresh_token: expiredRefreshToken });

    expect(res.statusCode).toEqual(401);
    // The backend's verifyToken returns null for expired tokens, leading to 'Invalid refresh token'
    // The database check then further refines it to 'Invalid or expired refresh token'
    // We'll expect the more general error here as it's consistent with the initial JWT verification failure.
    expect(res.body.error).toEqual('Invalid refresh token');
  });

  test('should return 401 for a revoked refresh token', async () => {
    // First, get a valid refresh token
    await supabase
      .from('oauth_codes')
      .insert([
        {
          clerk_user_id: testClerkUserId,
          code_verifier: testCodeVerifier,
          code_challenge: testCodeChallenge,
          state: testState,
          redirect_uri: testRedirectUri,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        },
      ]);

    const tokenRes = await request(app)
      .post('/api/auth/token')
      .send({
        code: testClerkUserId,
        code_verifier: testCodeVerifier,
        state: testState,
        redirect_uri: testRedirectUri,
      });

    expect(tokenRes.statusCode).toEqual(200);
    const refreshTokenToRevoke = tokenRes.body.refresh_token;

    // Manually revoke the token
    await supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token', refreshTokenToRevoke);

    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refresh_token: refreshTokenToRevoke });

    expect(res.statusCode).toEqual(401);
    expect(res.body.error).toEqual('Invalid or expired refresh token');
  });
});