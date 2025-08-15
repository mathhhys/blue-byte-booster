require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testStripeIntegration() {
  try {
    console.log('💳 Testing Stripe-Supabase integration...');
    
    // Create test user first
    const mockClerkUser = {
      id: 'clerk_stripe_test_123',
      email: 'stripe-test@example.com'
    };
    
    const client = await pool.connect();
    
    // Create user
    const userResult = await client.query(
      'SELECT upsert_user($1, $2, $3, $4, $5) as user_id',
      [mockClerkUser.id, mockClerkUser.email, 'Stripe', 'Test', 'starter']
    );
    
    const userId = userResult.rows[0].user_id;
    console.log('👤 Test user created with ID:', userId);
    
    // Test Stripe customer creation
    console.log('🏪 Creating Stripe customer...');
    const customer = await stripe.customers.create({
      email: mockClerkUser.email,
      description: `Test customer for Clerk user ${mockClerkUser.id}`,
      metadata: {
        clerk_user_id: mockClerkUser.id
      }
    });
    
    console.log('✅ Stripe customer created:', customer.id);
    
    // Update user with Stripe customer ID
    await client.query(
      'UPDATE users SET stripe_customer_id = $1 WHERE clerk_id = $2',
      [customer.id, mockClerkUser.id]
    );
    
    console.log('🔗 User linked to Stripe customer');
    
    // Test subscription creation in database
    console.log('📋 Creating test subscription...');
    const subscriptionResult = await client.query(`
      INSERT INTO subscriptions (user_id, stripe_subscription_id, plan_type, billing_frequency, seats, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [userId, 'sub_test_123', 'pro', 'monthly', 1, 'active']);
    
    const subscriptionId = subscriptionResult.rows[0].id;
    console.log('✅ Subscription created with ID:', subscriptionId);
    
    // Test credit granting for paid plan
    const creditResult = await client.query(
      'SELECT grant_credits($1, $2, $3, $4) as success',
      [mockClerkUser.id, 500, 'Pro plan credits', 'sub_test_123']
    );
    
    console.log('💰 Pro plan credits granted:', creditResult.rows[0].success);
    
    // Verify data via Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        *,
        subscriptions (*)
      `)
      .eq('clerk_id', mockClerkUser.id)
      .single();
    
    if (userError) throw userError;
    
    console.log('📊 User data with subscription:', {
      id: userData.id,
      clerk_id: userData.clerk_id,
      email: userData.email,
      plan_type: userData.plan_type,
      credits: userData.credits,
      stripe_customer_id: userData.stripe_customer_id,
      subscriptions: userData.subscriptions.length
    });
    
    // Test webhook simulation - checkout session completed
    console.log('🎣 Simulating Stripe webhook processing...');
    
    const mockSession = {
      id: 'cs_test_123',
      subscription: 'sub_test_123',
      metadata: {
        clerk_user_id: mockClerkUser.id,
        plan_type: 'pro',
        billing_frequency: 'monthly',
        seats: '1'
      }
    };
    
    // Simulate webhook processing logic
    await client.query(
      'UPDATE users SET plan_type = $1 WHERE clerk_id = $2',
      [mockSession.metadata.plan_type, mockSession.metadata.clerk_user_id]
    );
    
    console.log('✅ Webhook simulation completed');
    
    // Clean up Stripe customer
    await stripe.customers.del(customer.id);
    console.log('🧹 Stripe customer deleted');
    
    // Clean up database
    await client.query('DELETE FROM users WHERE clerk_id = $1', [mockClerkUser.id]);
    console.log('🧹 Test data cleaned up');
    
    client.release();
    await pool.end();
    
    console.log('✅ Stripe-Supabase integration test completed successfully!');
    
  } catch (err) {
    console.error('❌ Stripe integration test failed:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

testStripeIntegration();