import handler from '../webhooks/clerk';
import { createClient } from '@supabase/supabase-js';
import { Webhook } from 'svix';
import * as dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config();

// Integration tests that verify actual database synchronization
describe('Clerk Webhook Handler - Integration Tests', () => {
  let supabase: any;
  let req: any, res: any;
  const testClerkId = 'test_clerk_user_' + Date.now();

  beforeAll(() => {
    // Use real Supabase client for integration testing
    supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  });

  beforeEach(() => {
    req = {
      method: 'POST',
      headers: {
        'svix-id': 'test-id',
        'svix-timestamp': Date.now().toString(),
        'svix-signature': 'test-signature',
      },
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  afterEach(async () => {
    // Clean up test data after each test
    await supabase.from('users').delete().eq('clerk_id', testClerkId);
  });

  it('should create a user in the database when user.created webhook is received', async () => {
    const payload = {
      type: 'user.created',
      data: {
        id: testClerkId,
        email_addresses: [{ email_address: 'integration-test@example.com' }],
        first_name: 'Integration',
        last_name: 'Test',
        image_url: 'https://example.com/avatar.png',
      },
    };

    // Mock the webhook verification to return our payload
    jest.spyOn(Webhook.prototype, 'verify').mockReturnValue(payload);

    req.body = payload;

    await handler(req, res);

    // Verify the user was created in the database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', testClerkId)
      .single();

    expect(error).toBeNull();
    expect(user).toBeTruthy();
    expect(user.clerk_id).toBe(testClerkId);
    expect(user.email).toBe('integration-test@example.com');
    expect(user.first_name).toBe('Integration');
    expect(user.last_name).toBe('Test');
    expect(user.avatar_url).toBe('https://example.com/avatar.png');
    expect(user.plan_type).toBe('starter');
    expect(user.credits).toBe(25);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should update a user in the database when user.updated webhook is received', async () => {
    // First create a user
    const { error: createError } = await supabase.from('users').insert({
      clerk_id: testClerkId,
      email: 'old-email@example.com',
      first_name: 'Old',
      last_name: 'Name',
      plan_type: 'starter',
      credits: 25,
    });
    expect(createError).toBeNull();

    const payload = {
      type: 'user.updated',
      data: {
        id: testClerkId,
        email_addresses: [{ email_address: 'updated-email@example.com' }],
        first_name: 'Updated',
        last_name: 'User',
        image_url: 'https://example.com/new-avatar.png',
      },
    };

    jest.spyOn(Webhook.prototype, 'verify').mockReturnValue(payload);
    req.body = payload;

    await handler(req, res);

    // Verify the user was updated in the database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', testClerkId)
      .single();

    expect(error).toBeNull();
    expect(user).toBeTruthy();
    expect(user.email).toBe('updated-email@example.com');
    expect(user.first_name).toBe('Updated');
    expect(user.last_name).toBe('User');
    expect(user.avatar_url).toBe('https://example.com/new-avatar.png');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should delete a user from the database when user.deleted webhook is received', async () => {
    // First create a user
    const { error: createError } = await supabase.from('users').insert({
      clerk_id: testClerkId,
      email: 'to-delete@example.com',
      first_name: 'To',
      last_name: 'Delete',
      plan_type: 'starter',
      credits: 25,
    });
    expect(createError).toBeNull();

    // Verify user exists
    const { data: userBefore } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', testClerkId)
      .single();
    expect(userBefore).toBeTruthy();

    const payload = {
      type: 'user.deleted',
      data: {
        id: testClerkId,
      },
    };

    jest.spyOn(Webhook.prototype, 'verify').mockReturnValue(payload);
    req.body = payload;

    await handler(req, res);

    // Verify the user was deleted from the database
    const { data: userAfter, error } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', testClerkId)
      .single();

    expect(userAfter).toBeNull();
    expect(error?.message).toContain('JSON object requested, multiple (or no) rows returned');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle user.created with missing email gracefully', async () => {
    const payload = {
      type: 'user.created',
      data: {
        id: testClerkId,
        email_addresses: [], // No email addresses
        first_name: 'No',
        last_name: 'Email',
      },
    };

    jest.spyOn(Webhook.prototype, 'verify').mockReturnValue(payload);
    req.body = payload;

    await handler(req, res);

    // Verify no user was created in the database
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', testClerkId)
      .single();

    expect(user).toBeNull();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should handle webhook signature verification failure', async () => {
    const payload = {
      type: 'user.created',
      data: {
        id: testClerkId,
        email_addresses: [{ email_address: 'test@example.com' }],
      },
    };

    // Mock verification to throw an error
    jest.spyOn(Webhook.prototype, 'verify').mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    req.body = payload;

    await handler(req, res);

    // Verify no user was created in the database
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', testClerkId)
      .single();

    expect(user).toBeNull();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});