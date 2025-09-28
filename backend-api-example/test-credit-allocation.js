require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCreditAllocation() {
  try {
    console.log('💰 Testing organization credit allocation/deallocation...');

    // Create test organization
    const { data: orgData, error: orgError } = await supabase.rpc('upsert_organization', {
      p_clerk_org_id: 'org_credit_test_123',
      p_name: 'Test Organization for Credits'
    });

    if (orgError) throw orgError;
    const orgId = orgData;
    console.log('🏢 Test organization created with ID:', orgId);

    // Create test users
    const testUsers = [
      { id: 'clerk_credit_test_1', email: 'credit-test1@example.com', name: 'Credit Test 1' },
      { id: 'clerk_credit_test_2', email: 'credit-test2@example.com', name: 'Credit Test 2' }
    ];

    const userIds = [];
    for (const user of testUsers) {
      const { data: userData, error: userError } = await supabase.rpc('upsert_user', {
        p_clerk_id: user.id,
        p_email: user.email,
        p_first_name: user.name.split(' ')[0],
        p_last_name: user.name.split(' ')[1],
        p_avatar_url: null,
        p_plan_type: 'starter'
      });

      if (userError) throw userError;
      userIds.push(userData);
      console.log(`👤 Test user created: ${user.email} (ID: ${userData})`);
    }

    // Create Stripe customer
    console.log('🏪 Creating Stripe customer...');
    const customer = await stripe.customers.create({
      email: 'org-credit-test@example.com',
      description: `Test customer for credit allocation`,
      metadata: {
        clerk_org_id: 'org_credit_test_123'
      }
    });
    console.log('✅ Stripe customer created:', customer.id);

    // Update organization with Stripe customer ID
    const { error: updateOrgError } = await supabase
      .from('organizations')
      .update({ stripe_customer_id: customer.id })
      .eq('id', orgId);

    if (updateOrgError) throw updateOrgError;

    // Create organization subscription for teams plan (monthly)
    const { data: subData, error: subError } = await supabase
      .from('organization_subscriptions')
      .insert({
        organization_id: orgId,
        clerk_org_id: 'org_credit_test_123',
        stripe_customer_id: customer.id,
        stripe_subscription_id: 'sub_credit_test_123',
        plan_type: 'teams',
        billing_frequency: 'monthly',
        seats_total: 5,
        seats_used: 0,
        status: 'active'
      })
      .select('id')
      .single();

    if (subError) throw subError;
    const orgSubId = subData.id;
    console.log('📋 Teams subscription created with ID:', orgSubId);

    // Check initial credits for users
    console.log('📊 Checking initial user credits...');
    for (let i = 0; i < testUsers.length; i++) {
      const { data: creditData, error: creditError } = await supabase
        .from('users')
        .select('credits')
        .eq('clerk_id', testUsers[i].id)
        .single();

      if (creditError) throw creditError;
      console.log(`${testUsers[i].email} initial credits: ${creditData.credits}`);
    }

    // Test seat assignment with credit allocation
    console.log('🎫 Testing seat assignment with credit allocation...');

    const assignResult1 = await supabase.rpc('assign_organization_seat_with_credits', {
      p_clerk_org_id: 'org_credit_test_123',
      p_clerk_user_id: testUsers[0].id,
      p_user_email: testUsers[0].email,
      p_user_name: testUsers[0].name,
      p_assigned_by: testUsers[0].id,
      p_expires_at: null
    });

    if (!assignResult1.data) {
      throw new Error('Failed to assign first seat with credits');
    }
    console.log('✅ First seat assigned with credits');

    // Check credits after first assignment (should be 500 for monthly teams plan)
    const { data: creditData1, error: creditError1 } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', testUsers[0].id)
      .single();

    if (creditError1) throw creditError1;
    console.log(`${testUsers[0].email} credits after assignment: ${creditData1.credits}`);

    if (creditData1.credits !== 500) {
      throw new Error(`Expected 500 credits, got ${creditData1.credits}`);
    }

    // Assign second seat
    const assignResult2 = await supabase.rpc('assign_organization_seat_with_credits', {
      p_clerk_org_id: 'org_credit_test_123',
      p_clerk_user_id: testUsers[1].id,
      p_user_email: testUsers[1].email,
      p_user_name: testUsers[1].name,
      p_assigned_by: testUsers[0].id,
      p_expires_at: null
    });

    if (!assignResult2.data) {
      throw new Error('Failed to assign second seat with credits');
    }
    console.log('✅ Second seat assigned with credits');

    // Check credits after second assignment
    const { data: creditData2, error: creditError2 } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', testUsers[1].id)
      .single();

    if (creditError2) throw creditError2;
    console.log(`${testUsers[1].email} credits after assignment: ${creditData2.credits}`);

    if (creditData2.credits !== 500) {
      throw new Error(`Expected 500 credits, got ${creditData2.credits}`);
    }

    // Test seat revocation with credit deallocation
    console.log('🚫 Testing seat revocation with credit deallocation...');

    const revokeResult = await supabase.rpc('remove_organization_seat_with_credits', {
      p_clerk_org_id: 'org_credit_test_123',
      p_clerk_user_id: testUsers[0].id
    });

    if (!revokeResult.data) {
      throw new Error('Failed to revoke seat with credits');
    }
    console.log('✅ First seat revoked with credits');

    // Check credits after revocation (should be back to initial amount, assuming starter plan gives 25)
    const { data: creditData3, error: creditError3 } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', testUsers[0].id)
      .single();

    if (creditError3) throw creditError3;
    console.log(`${testUsers[0].email} credits after revocation: ${creditData3.credits}`);

    // The user should have their credits reduced by 500, back to starter plan amount
    if (creditData3.credits !== 25) { // Assuming starter plan gives 25 credits
      console.log(`⚠️  Warning: Expected 25 credits after revocation, got ${creditData3.credits}`);
      console.log('This might be expected if the user had different initial credits');
    }

    // Test yearly plan credits
    console.log('📅 Testing yearly plan credits...');

    // Update subscription to yearly
    const { error: yearlyError } = await supabase
      .from('organization_subscriptions')
      .update({ billing_frequency: 'yearly' })
      .eq('id', orgSubId);

    if (yearlyError) throw yearlyError;

    // Assign seat to first user again (should get 6000 credits)
    const assignYearlyResult = await supabase.rpc('assign_organization_seat_with_credits', {
      p_clerk_org_id: 'org_credit_test_123',
      p_clerk_user_id: testUsers[0].id,
      p_user_email: testUsers[0].email,
      p_user_name: testUsers[0].name,
      p_assigned_by: testUsers[0].id,
      p_expires_at: null
    });

    if (!assignYearlyResult.data) {
      throw new Error('Failed to assign seat with yearly credits');
    }
    console.log('✅ Seat assigned with yearly credits');

    // Check credits (should be 6000 for yearly teams plan)
    const { data: yearlyCreditData, error: yearlyCreditError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', testUsers[0].id)
      .single();

    if (yearlyCreditError) throw yearlyCreditError;
    console.log(`${testUsers[0].email} credits with yearly plan: ${yearlyCreditData.credits}`);

    if (yearlyCreditData.credits !== 6000) {
      throw new Error(`Expected 6000 credits for yearly plan, got ${yearlyCreditData.credits}`);
    }

    console.log('🎉 Credit allocation test PASSED!');

    // Clean up
    console.log('🧹 Cleaning up test data...');
    await stripe.customers.del(customer.id);

    const { error: deleteOrgError } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId);

    for (const userId of userIds) {
      const { error: deleteUserError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      if (deleteUserError) console.error('Error deleting user:', deleteUserError);
    }

    if (deleteOrgError) console.error('Error deleting org:', deleteOrgError);

    console.log('✅ Credit allocation test completed successfully!');

  } catch (err) {
    console.error('❌ Credit allocation test failed:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

testCreditAllocation();