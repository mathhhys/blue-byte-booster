require('dotenv').config();
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

async function testClerkIntegration() {
  try {
    console.log('🧪 Testing Clerk-Supabase integration...');
    
    // Mock Clerk user data
    const mockClerkUser = {
      id: 'clerk_test_user_123',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
      firstName: 'Test',
      lastName: 'User'
    };
    
    console.log('👤 Creating test user with Clerk ID:', mockClerkUser.id);
    
    // Test upsert_user function via direct PostgreSQL
    const client = await pool.connect();
    
    const result = await client.query(
      'SELECT upsert_user($1, $2, $3, $4, $5) as user_id',
      [
        mockClerkUser.id,
        mockClerkUser.emailAddresses[0].emailAddress,
        mockClerkUser.firstName,
        mockClerkUser.lastName,
        'starter'
      ]
    );
    
    const userId = result.rows[0].user_id;
    console.log('✅ User created with ID:', userId);
    
    // Test credit granting
    const creditResult = await client.query(
      'SELECT grant_credits($1, $2, $3, $4) as success',
      [mockClerkUser.id, 25, 'Welcome bonus', 'test_signup']
    );
    
    console.log('💰 Credits granted:', creditResult.rows[0].success);
    
    // Verify user data via Supabase client
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', mockClerkUser.id)
      .single();
    
    if (userError) throw userError;
    
    console.log('📊 User data retrieved via Supabase:', {
      id: userData.id,
      clerk_id: userData.clerk_id,
      email: userData.email,
      plan_type: userData.plan_type,
      credits: userData.credits
    });
    
    // Test credit transactions
    const { data: transactions, error: transError } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userData.id);
    
    if (transError) throw transError;
    
    console.log('💳 Credit transactions:', transactions.length);
    
    // Clean up test data
    await client.query('DELETE FROM users WHERE clerk_id = $1', [mockClerkUser.id]);
    console.log('🧹 Test data cleaned up');
    
    client.release();
    await pool.end();
    
    console.log('✅ Clerk-Supabase integration test completed successfully!');
    
  } catch (err) {
    console.error('❌ Clerk integration test failed:', err.message);
    process.exit(1);
  }
}

testClerkIntegration();