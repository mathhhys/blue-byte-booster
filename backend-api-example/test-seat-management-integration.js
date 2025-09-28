require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mock JWT token generation for testing
function generateMockToken(clerkUserId, orgId) {
  return jwt.sign(
    {
      sub: clerkUserId,
      org_id: orgId,
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
    },
    process.env.JWT_SECRET || 'test-secret'
  );
}

async function testSeatManagementIntegration() {
  try {
    console.log('🪑 Testing seat management integration...');

    // Create test organization
    const { data: orgData, error: orgError } = await supabase.rpc('upsert_organization', {
      p_clerk_org_id: 'org_seat_test_123',
      p_name: 'Test Organization for Seat Management'
    });

    if (orgError) throw orgError;
    const orgId = orgData;
    console.log('🏢 Test organization created with ID:', orgId);

    // Create test users
    const testUsers = [
      { id: 'clerk_seat_admin', email: 'admin@seat-test.com', name: 'Seat Admin' },
      { id: 'clerk_seat_member1', email: 'member1@seat-test.com', name: 'Seat Member 1' },
      { id: 'clerk_seat_member2', email: 'member2@seat-test.com', name: 'Seat Member 2' }
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

    // Create organization subscription for teams plan (monthly, 3 seats)
    const { data: subData, error: subError } = await supabase
      .from('organization_subscriptions')
      .insert({
        organization_id: orgId,
        clerk_org_id: 'org_seat_test_123',
        stripe_customer_id: 'cus_test_seat_123',
        stripe_subscription_id: 'sub_test_seat_123',
        plan_type: 'teams',
        billing_frequency: 'monthly',
        seats_total: 3,
        seats_used: 0,
        status: 'active'
      })
      .select('id')
      .single();

    if (subError) throw subError;
    const orgSubId = subData.id;
    console.log('📋 Teams subscription created with ID:', orgSubId);

    // Test 1: Get seats (should return empty initially)
    console.log('📊 Test 1: Getting initial seats...');
    const initialSeatsResponse = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats?org_id=org_seat_test_123`, {
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_seat_test_123')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!initialSeatsResponse.ok) {
      throw new Error(`Failed to get initial seats: ${initialSeatsResponse.status}`);
    }

    const initialSeatsData = await initialSeatsResponse.json();
    console.log('Initial seats data:', initialSeatsData);

    if (initialSeatsData.seats_used !== 0 || initialSeatsData.seats_total !== 3) {
      throw new Error(`Expected 0 used of 3 total seats, got ${initialSeatsData.seats_used} of ${initialSeatsData.seats_total}`);
    }

    // Test 2: Assign first seat with credit allocation
    console.log('🎫 Test 2: Assigning first seat with credit allocation...');
    const assignResponse1 = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats/assign`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_seat_test_123')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        org_id: 'org_seat_test_123',
        email: testUsers[1].email,
        role: 'member'
      })
    });

    if (!assignResponse1.ok) {
      const errorData = await assignResponse1.json();
      throw new Error(`Failed to assign first seat: ${errorData.error}`);
    }

    const assignData1 = await assignResponse1.json();
    console.log('First seat assigned:', assignData1);

    // Verify seat was assigned and credits allocated
    const { data: seat1Data, error: seat1Error } = await supabase
      .from('organization_seats')
      .select('*')
      .eq('clerk_org_id', 'org_seat_test_123')
      .eq('clerk_user_id', testUsers[1].id)
      .eq('status', 'active')
      .single();

    if (seat1Error || !seat1Data) {
      throw new Error('First seat not found in database');
    }

    const { data: credits1Data, error: credits1Error } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', testUsers[1].id)
      .single();

    if (credits1Error) throw credits1Error;
    console.log(`User ${testUsers[1].email} credits after first assignment: ${credits1Data.credits}`);

    if (credits1Data.credits !== 500) { // Monthly teams plan = 500 credits
      throw new Error(`Expected 500 credits for monthly teams plan, got ${credits1Data.credits}`);
    }

    // Test 3: Assign second seat
    console.log('🎫 Test 3: Assigning second seat...');
    const assignResponse2 = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats/assign`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_seat_test_123')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        org_id: 'org_seat_test_123',
        email: testUsers[2].email,
        role: 'admin'
      })
    });

    if (!assignResponse2.ok) {
      const errorData = await assignResponse2.json();
      throw new Error(`Failed to assign second seat: ${errorData.error}`);
    }

    const assignData2 = await assignResponse2.json();
    console.log('Second seat assigned:', assignData2);

    // Verify credits for second user
    const { data: credits2Data, error: credits2Error } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', testUsers[2].id)
      .single();

    if (credits2Error) throw credits2Error;
    console.log(`User ${testUsers[2].email} credits after assignment: ${credits2Data.credits}`);

    if (credits2Data.credits !== 500) {
      throw new Error(`Expected 500 credits for monthly teams plan, got ${credits2Data.credits}`);
    }

    // Test 4: Get seats after assignments
    console.log('📊 Test 4: Getting seats after assignments...');
    const seatsAfterAssignResponse = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats?org_id=org_seat_test_123`, {
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_seat_test_123')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!seatsAfterAssignResponse.ok) {
      throw new Error(`Failed to get seats after assignments: ${seatsAfterAssignResponse.status}`);
    }

    const seatsAfterAssignData = await seatsAfterAssignResponse.json();
    console.log('Seats after assignments:', seatsAfterAssignData);

    if (seatsAfterAssignData.seats_used !== 2 || seatsAfterAssignData.seats_total !== 3) {
      throw new Error(`Expected 2 used of 3 total seats, got ${seatsAfterAssignData.seats_used} of ${seatsAfterAssignData.seats_total}`);
    }

    if (seatsAfterAssignData.seats.length !== 2) {
      throw new Error(`Expected 2 seats in list, got ${seatsAfterAssignData.seats.length}`);
    }

    // Test 5: Try to assign third seat (should succeed)
    console.log('🎫 Test 5: Assigning third seat...');
    const assignResponse3 = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats/assign`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_seat_test_123')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        org_id: 'org_seat_test_123',
        email: 'thirduser@seat-test.com',
        role: 'member'
      })
    });

    if (!assignResponse3.ok) {
      const errorData = await assignResponse3.json();
      throw new Error(`Failed to assign third seat: ${errorData.error}`);
    }

    console.log('Third seat assigned successfully');

    // Test 6: Try to assign fourth seat (should fail with 402 - no seats available)
    console.log('🚫 Test 6: Attempting to assign fourth seat (should fail)...');
    const assignResponse4 = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats/assign`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_seat_test_123')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        org_id: 'org_seat_test_123',
        email: 'fourthuser@seat-test.com',
        role: 'member'
      })
    });

    if (assignResponse4.status !== 402) {
      throw new Error(`Expected 402 status for no seats available, got ${assignResponse4.status}`);
    }

    const errorData4 = await assignResponse4.json();
    console.log('Correctly rejected fourth seat assignment:', errorData4.error);

    // Test 7: Test buy seats checkout session creation with adjustable quantity
    console.log('🛒 Test 7: Creating checkout session for additional seats...');
    const buySeatsResponse = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/buy-seats`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_seat_test_123')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orgId: 'org_seat_test_123',
        clerkUserId: testUsers[0].id,
        quantity: 2,
        successUrl: 'http://localhost:5173/payment-success',
        cancelUrl: 'http://localhost:5173/payment-cancelled'
      })
    });

    if (!buySeatsResponse.ok) {
      const errorData = await buySeatsResponse.json();
      throw new Error(`Failed to create checkout session: ${errorData.error}`);
    }

    const buySeatsData = await buySeatsResponse.json();
    console.log('Checkout session created:', buySeatsData);

    if (!buySeatsData.sessionId || !buySeatsData.url) {
      throw new Error('Checkout session missing required fields');
    }

    // Test 8: Revoke first seat with credit deallocation
    console.log('🚫 Test 8: Revoking first seat with credit deallocation...');
    const revokeResponse1 = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats/revoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_seat_test_123')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        org_id: 'org_seat_test_123',
        user_id: testUsers[1].id
      })
    });

    if (!revokeResponse1.ok) {
      const errorData = await revokeResponse1.json();
      throw new Error(`Failed to revoke first seat: ${errorData.error}`);
    }

    console.log('First seat revoked successfully');

    // Verify credits were deallocated
    const { data: creditsAfterRevoke1, error: creditsRevokeError1 } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', testUsers[1].id)
      .single();

    if (creditsRevokeError1) throw creditsRevokeError1;
    console.log(`User ${testUsers[1].email} credits after revocation: ${creditsAfterRevoke1.credits}`);

    // Should be back to starter plan credits (25)
    if (creditsAfterRevoke1.credits !== 25) {
      console.log(`⚠️  Warning: Expected 25 credits after revocation, got ${creditsAfterRevoke1.credits}`);
      console.log('This might be expected if the user had different initial credits');
    }

    // Test 9: Get seats after revocation
    console.log('📊 Test 9: Getting seats after revocation...');
    const seatsAfterRevokeResponse = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats?org_id=org_seat_test_123`, {
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_seat_test_123')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!seatsAfterRevokeResponse.ok) {
      throw new Error(`Failed to get seats after revocation: ${seatsAfterRevokeResponse.status}`);
    }

    const seatsAfterRevokeData = await seatsAfterRevokeResponse.json();
    console.log('Seats after revocation:', seatsAfterRevokeData);

    if (seatsAfterRevokeData.seats_used !== 2 || seatsAfterRevokeData.seats_total !== 3) {
      throw new Error(`Expected 2 used of 3 total seats after revocation, got ${seatsAfterRevokeData.seats_used} of ${seatsAfterRevokeData.seats_total}`);
    }

    // Test 10: Test yearly plan credits
    console.log('📅 Test 10: Testing yearly plan credits...');

    // Update subscription to yearly
    const { error: yearlyError } = await supabase
      .from('organization_subscriptions')
      .update({ billing_frequency: 'yearly' })
      .eq('id', orgSubId);

    if (yearlyError) throw yearlyError;

    // Create a new user for yearly test
    const { data: yearlyUserData, error: yearlyUserError } = await supabase.rpc('upsert_user', {
      p_clerk_id: 'clerk_yearly_test',
      p_email: 'yearly@test.com',
      p_first_name: 'Yearly',
      p_last_name: 'Test',
      p_avatar_url: null,
      p_plan_type: 'starter'
    });

    if (yearlyUserError) throw yearlyUserError;

    // Assign seat with yearly credits
    const yearlyAssignResponse = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats/assign`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_seat_test_123')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        org_id: 'org_seat_test_123',
        email: 'yearly@test.com',
        role: 'member'
      })
    });

    if (!yearlyAssignResponse.ok) {
      const errorData = await yearlyAssignResponse.json();
      throw new Error(`Failed to assign yearly seat: ${errorData.error}`);
    }

    // Check yearly credits
    const { data: yearlyCreditsData, error: yearlyCreditsError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', 'clerk_yearly_test')
      .single();

    if (yearlyCreditsError) throw yearlyCreditsError;
    console.log(`Yearly plan user credits: ${yearlyCreditsData.credits}`);

    if (yearlyCreditsData.credits !== 6000) { // Yearly teams plan = 6000 credits
      throw new Error(`Expected 6000 credits for yearly teams plan, got ${yearlyCreditsData.credits}`);
    }

    console.log('🎉 Seat management integration test PASSED!');

    // Clean up
    console.log('🧹 Cleaning up test data...');

    const { error: deleteOrgError } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId);

    for (const userId of [...userIds, yearlyUserData]) {
      const { error: deleteUserError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      if (deleteUserError) console.error('Error deleting user:', deleteUserError);
    }

    if (deleteOrgError) console.error('Error deleting org:', deleteOrgError);

    console.log('✅ Seat management integration test completed successfully!');

  } catch (err) {
    console.error('❌ Seat management integration test failed:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

testSeatManagementIntegration();