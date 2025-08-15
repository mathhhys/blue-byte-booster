// Test script for starter plan implementation
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const testStarterPlan = async () => {
  console.log('🧪 Testing Starter Plan Implementation...\n');

  const testUser = {
    clerk_id: `test_starter_${Date.now()}`,
    email: 'starter-test@example.com',
    first_name: 'Starter',
    last_name: 'Test'
  };

  try {
    // Test 1: Create starter user
    console.log('1️⃣ Testing user creation with starter plan...');
    const { data: userId, error: createError } = await supabase.rpc('upsert_user', {
      p_clerk_id: testUser.clerk_id,
      p_email: testUser.email,
      p_first_name: testUser.first_name,
      p_last_name: testUser.last_name,
      p_plan_type: 'starter'
    });

    if (createError) throw createError;
    console.log('✅ User created successfully with ID:', userId);

    // Test 2: Verify user was created with correct plan and default credits
    console.log('\n2️⃣ Verifying user data...');
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', testUser.clerk_id)
      .single();

    if (fetchError) throw fetchError;
    
    console.log('✅ User data:', {
      id: user.id,
      clerk_id: user.clerk_id,
      email: user.email,
      plan_type: user.plan_type,
      credits: user.credits
    });

    if (user.plan_type !== 'starter') {
      throw new Error(`Expected plan_type 'starter', got '${user.plan_type}'`);
    }

    if (user.credits !== 25) {
      throw new Error(`Expected 25 credits, got ${user.credits}`);
    }

    // Test 3: Verify no subscription record was created (starter plans are free)
    console.log('\n3️⃣ Verifying no subscription record exists...');
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id);

    if (subError) throw subError;
    
    if (subscriptions.length > 0) {
      throw new Error(`Expected no subscriptions for starter plan, found ${subscriptions.length}`);
    }
    console.log('✅ No subscription records found (correct for starter plan)');

    // Test 7: Test API endpoint
    console.log('\n7️⃣ Testing starter plan API endpoint...');
    const response = await fetch('http://localhost:3001/api/starter/process-signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clerkUserId: `test_api_${Date.now()}`,
        email: 'api-test@example.com',
        firstName: 'API',
        lastName: 'Test'
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const apiResult = await response.json();
    console.log('✅ API endpoint response:', apiResult);

    if (!apiResult.success) {
      throw new Error(`API returned success: false`);
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await supabase.from('users').delete().eq('clerk_id', testUser.clerk_id);
    await supabase.from('users').delete().eq('clerk_id', `test_api_${Date.now()}`);
    console.log('✅ Cleanup completed');

    console.log('\n🎉 All starter plan tests passed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    // Cleanup on error
    try {
      await supabase.from('users').delete().eq('clerk_id', testUser.clerk_id);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }
    
    process.exit(1);
  }
};

// Run the test
testStarterPlan();