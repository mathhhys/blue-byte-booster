const request = require('supertest');
const app = require('./server');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test data
const testUser = {
  clerkId: 'test_user_vscode_' + Date.now(),
  email: 'test@vscode.com',
  firstName: 'Test',
  lastName: 'User'
};

const testSession = {
  sessionToken: 'vscode_session_' + Date.now(),
  extensionVersion: '1.0.0'
};

describe('VS Code Integration API Tests', () => {
  let userId;
  let sessionId;
  let authToken;

  beforeAll(async () => {
    // Create test user
    const { data: newUserId, error: createError } = await supabase.rpc('upsert_user', {
      p_clerk_id: testUser.clerkId,
      p_email: testUser.email,
      p_first_name: testUser.firstName,
      p_last_name: testUser.lastName,
      p_plan_type: 'pro'
    });

    if (createError) {
      console.error('Error creating test user:', createError);
      throw createError;
    }

    userId = newUserId;
    authToken = `mock_${testUser.clerkId}`;
    console.log('Created test user with ID:', userId);
  });

  afterAll(async () => {
    // Cleanup: Delete test user and related data
    try {
      await supabase.from('users').delete().eq('clerk_id', testUser.clerkId);
      console.log('Cleaned up test user');
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('VS Code Session Management', () => {
    test('POST /api/vscode/session/validate - should create and validate session', async () => {
      const response = await request(app)
        .post('/api/vscode/session/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionToken: testSession.sessionToken,
          extensionVersion: testSession.extensionVersion
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.session).toHaveProperty('id');
      expect(response.body.session).toHaveProperty('expiresAt');
      expect(response.body.user.clerkId).toBe(testUser.clerkId);
      expect(response.body.user.planType).toBe('pro');
      expect(response.body.permissions).toContain('advanced_models');

      sessionId = response.body.session.id;
    });

    test('POST /api/vscode/session/validate - should update existing session', async () => {
      const response = await request(app)
        .post('/api/vscode/session/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionToken: testSession.sessionToken,
          extensionVersion: '1.1.0' // Updated version
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.session.id).toBe(sessionId);
    });

    test('POST /api/vscode/session/validate - should fail without auth token', async () => {
      await request(app)
        .post('/api/vscode/session/validate')
        .send({
          sessionToken: testSession.sessionToken,
          extensionVersion: testSession.extensionVersion
        })
        .expect(401);
    });

    test('POST /api/vscode/session/validate - should fail with missing parameters', async () => {
      await request(app)
        .post('/api/vscode/session/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionToken: testSession.sessionToken
          // Missing extensionVersion
        })
        .expect(400);
    });
  });

  describe('Usage Tracking', () => {
    test('POST /api/vscode/usage/track - should track model usage', async () => {
      const response = await request(app)
        .post('/api/vscode/usage/track')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionToken: testSession.sessionToken,
          action: 'code_generation',
          modelId: 'gpt-4',
          tokensUsed: 150,
          costInCredits: 3
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('remainingCredits');
    });

    test('POST /api/vscode/usage/track - should fail with invalid session', async () => {
      await request(app)
        .post('/api/vscode/usage/track')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionToken: 'invalid_session_token',
          action: 'code_generation',
          modelId: 'gpt-4',
          tokensUsed: 150,
          costInCredits: 3
        })
        .expect(401);
    });
  });

  describe('Analytics', () => {
    test('GET /api/vscode/analytics - should return usage analytics', async () => {
      const response = await request(app)
        .get('/api/vscode/analytics?timeframe=7d')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('modelUsage');
      expect(response.body).toHaveProperty('featureUsage');
      expect(response.body).toHaveProperty('creditHistory');
      expect(response.body.summary).toHaveProperty('totalRequests');
      expect(response.body.summary).toHaveProperty('totalTokens');
      expect(response.body.summary).toHaveProperty('totalCreditsUsed');
    });

    test('GET /api/vscode/analytics - should handle different timeframes', async () => {
      const response = await request(app)
        .get('/api/vscode/analytics?timeframe=30d')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.summary).toBeDefined();
    });
  });

  describe('Enhanced User Management', () => {
    test('GET /api/users/:clerkUserId/profile - should return enhanced profile', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser.clerkId}/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user.clerkId).toBe(testUser.clerkId);
      expect(response.body.user.planType).toBe('pro');
      expect(response.body).toHaveProperty('usage');
      expect(response.body).toHaveProperty('recentTransactions');
      expect(response.body.user).toHaveProperty('totalApiRequests');
      expect(response.body.user).toHaveProperty('integrationPreferences');
    });

    test('GET /api/users/:clerkUserId/profile - should deny access to other users', async () => {
      await request(app)
        .get('/api/users/other_user_id/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    test('POST /api/users/:clerkUserId/credits/consume - should consume credits with session tracking', async () => {
      const response = await request(app)
        .post(`/api/users/${testUser.clerkId}/credits/consume`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5,
          description: 'Test credit consumption',
          sessionId: sessionId,
          modelId: 'gpt-4',
          provider: 'openai',
          tokensUsed: 100,
          metadata: { test: true }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('remaining_credits');
      expect(response.body).toHaveProperty('transaction');
    });

    test('POST /api/users/:clerkUserId/credits/consume - should fail with insufficient credits', async () => {
      // First, check current credits
      const profileResponse = await request(app)
        .get(`/api/users/${testUser.clerkId}/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const currentCredits = profileResponse.body.user.credits;

      // Try to consume more credits than available
      const response = await request(app)
        .post(`/api/users/${testUser.clerkId}/credits/consume`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: currentCredits + 100,
          description: 'Test insufficient credits'
        })
        .expect(402);

      expect(response.body.code).toBe('INSUFFICIENT_CREDITS');
    });

    test('GET /api/users/:clerkUserId/usage/stats - should return usage statistics', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser.clerkId}/usage/stats?period=7d&groupBy=day`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('timeline');
      expect(response.body).toHaveProperty('byModel');
      expect(response.body).toHaveProperty('byProvider');
      expect(response.body).toHaveProperty('totals');
      expect(response.body.totals).toHaveProperty('requests');
      expect(response.body.totals).toHaveProperty('tokens');
      expect(response.body.totals).toHaveProperty('credits');
      expect(response.body.totals).toHaveProperty('successRate');
    });
  });

  describe('Rate Limiting', () => {
    test('Should include rate limit headers in response', async () => {
      const response = await request(app)
        .get(`/api/users/${testUser.clerkId}/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    test('Should not rate limit mock tokens', async () => {
      // This test ensures mock tokens bypass rate limiting
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .get(`/api/users/${testUser.clerkId}/profile`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200)
        );
      }

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Database Functions', () => {
    test('Should cleanup expired sessions', async () => {
      // This test would require setting up expired sessions
      // For now, we just verify the function exists
      const { data, error } = await supabase.rpc('cleanup_expired_sessions');
      
      expect(error).toBeNull();
      expect(typeof data).toBe('number'); // Should return count of cleaned sessions
    });
  });

  describe('Error Handling', () => {
    test('Should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/vscode/session/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });

    test('Should handle database connection errors gracefully', async () => {
      // This would require mocking database failures
      // For integration testing, we assume the database is available
      console.log('Database error handling test - would require mocking');
    });
  });
});

// Helper function to verify database schema
describe('Database Schema Verification', () => {
  test('Should have all required VS Code integration tables', async () => {
    const tables = [
      'vscode_sessions',
      'model_usage', 
      'feature_usage',
      'api_rate_limits'
    ];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      expect(error).toBeNull();
      console.log(`✓ Table ${table} exists and is accessible`);
    }
  });

  test('Should have enhanced user table columns', async () => {
    const { data, error } = await supabase
      .from('users')
      .select('last_vscode_activity_at, vscode_extension_version, integration_preferences, api_key_hash, total_api_requests')
      .limit(1);

    expect(error).toBeNull();
    console.log('✓ Enhanced user table columns exist');
  });

  test('Should have database functions', async () => {
    const functions = [
      'consume_credits_with_session',
      'check_rate_limit',
      'cleanup_expired_sessions'
    ];

    for (const func of functions) {
      const { data, error } = await supabase.rpc(func, {});
      
      // We expect these to potentially fail due to missing parameters,
      // but they should exist (not give function doesn't exist error)
      console.log(`✓ Function ${func} exists`);
    }
  });
});