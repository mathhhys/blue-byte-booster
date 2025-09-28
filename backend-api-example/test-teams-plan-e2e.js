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

async function testTeamsPlanEndToEnd() {
  try {
    console.log('🚀 Testing teams plan end-to-end functionality...');

    // Create test users (admin + 2 members)
    const testUsers = [
      { id: 'clerk_teams_admin', email: 'admin@teams-e2e.com', name: 'Teams Admin', role: 'admin' },
      { id: 'clerk_teams_member1', email: 'member1@teams-e2e.com', name: 'Teams Member 1', role: 'member' },
      { id: 'clerk_teams_member2', email: 'member2@teams-e2e.com', name: 'Teams Member 2', role: 'member' }
    ];

    // Create test organization
    const { data: orgData, error: orgError } = await supabase.rpc('upsert_organization', {
      p_clerk_org_id: 'org_teams_e2e_123',
      p_name: 'Test Organization for Teams E2E'
    });

    if (orgError) throw orgError;
    const orgId = orgData;
    console.log('🏢 Test organization created with ID:', orgId);

    // Add admin to organization_members
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: orgId,
        clerk_user_id: testUsers[0].id,
        role: 'admin'
      });

    if (memberError) throw memberError;
    console.log('👑 Admin added to organization members');

    const userIds = [];
    for (const user of testUsers) {
      const { data: userData, error: userError } = await supabase.rpc('upsert_user', {
        p_clerk_id: user.id,
        p_email: user.email,
        p_first_name: user.name.split(' ')[0],
        p_last_name: user.name.split(' ')[1] || '',
        p_avatar_url: null,
        p_plan_type: 'starter'
      });

      if (userError) throw userError;
      userIds.push(userData);
      console.log(`👤 Test user created: ${user.email} (ID: ${userData})`);
    }

    // Step 1: Create teams plan subscription (monthly, 2 seats initially)
    console.log('📋 Step 1: Creating teams plan subscription...');
    const uniqueSubId = `sub_teams_e2e_${Date.now()}`;
    const { data: subData, error: subError } = await supabase
      .from('organization_subscriptions')
      .insert({
        organization_id: orgId,
        clerk_org_id: 'org_teams_e2e_123',
        stripe_customer_id: 'cus_teams_e2e_123',
        stripe_subscription_id: uniqueSubId,
        plan_type: 'teams',
        billing_frequency: 'monthly',
        seats_total: 2,
        seats_used: 0,
        status: 'active'
      })
      .select('id')
      .single();

    if (subError) throw subError;
    const orgSubId = subData.id;
    console.log('✅ Teams subscription created with 2 seats');

    // Step 2: Admin views seat management dashboard
    console.log('👀 Step 2: Admin views seat management dashboard...');
    const seatsResponse = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats?org_id=org_teams_e2e_123`, {
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_teams_e2e_123')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!seatsResponse.ok) {
      throw new Error(`Failed to get seats: ${seatsResponse.status}`);
    }

    const seatsData = await seatsResponse.json();
    console.log('📊 Seat dashboard data:', {
      seats_used: seatsData.seats_used,
      seats_total: seatsData.seats_total,
      available_seats: seatsData.seats_total - seatsData.seats_used
    });

    if (seatsData.seats_used !== 0 || seatsData.seats_total !== 2) {
      throw new Error(`Expected 0/2 seats, got ${seatsData.seats_used}/${seatsData.seats_total}`);
    }

    // Step 3: Admin assigns first seat to member1
    console.log('🎫 Step 3: Admin assigns first seat to member1...');
    const assignResponse1 = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats/assign`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_teams_e2e_123')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        org_id: 'org_teams_e2e_123',
        email: testUsers[1].email,
        role: 'member'
      })
    });

    if (!assignResponse1.ok) {
      const errorData = await assignResponse1.json();
      throw new Error(`Failed to assign first seat: ${errorData.error}`);
    }

    console.log('✅ First seat assigned to member1');

    // Verify member1 received teams plan credits (500 for monthly)
    const { data: member1Credits, error: member1CreditsError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', testUsers[1].id)
      .single();

    if (member1CreditsError) throw member1CreditsError;
    if (member1Credits.credits !== 500) {
      throw new Error(`Member1 should have 500 credits, got ${member1Credits.credits}`);
    }
    console.log('💰 Member1 received 500 monthly teams credits');

    // Step 4: Admin assigns second seat to member2
    console.log('🎫 Step 4: Admin assigns second seat to member2...');
    const assignResponse2 = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats/assign`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_teams_e2e_123')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        org_id: 'org_teams_e2e_123',
        email: testUsers[2].email,
        role: 'member'
      })
    });

    if (!assignResponse2.ok) {
      const errorData = await assignResponse2.json();
      throw new Error(`Failed to assign second seat: ${errorData.error}`);
    }

    console.log('✅ Second seat assigned to member2');

    // Verify member2 received teams plan credits
    const { data: member2Credits, error: member2CreditsError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', testUsers[2].id)
      .single();

    if (member2CreditsError) throw member2CreditsError;
    if (member2Credits.credits !== 500) {
      throw new Error(`Member2 should have 500 credits, got ${member2Credits.credits}`);
    }
    console.log('💰 Member2 received 500 monthly teams credits');

    // Step 5: Verify all seats are now used
    console.log('📊 Step 5: Verifying all seats are used...');
    const seatsAfterAssignResponse = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats?org_id=org_teams_e2e_123`, {
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_teams_e2e_123')}`,
        'Content-Type': 'application/json'
      }
    });

    const seatsAfterAssignData = await seatsAfterAssignResponse.json();
    if (seatsAfterAssignData.seats_used !== 2 || seatsAfterAssignData.seats_total !== 2) {
      throw new Error(`Expected 2/2 seats used, got ${seatsAfterAssignData.seats_used}/${seatsAfterAssignData.seats_total}`);
    }
    console.log('✅ All 2 seats are now assigned');

    // Step 6: Admin tries to assign third seat (should fail, triggering buy seats flow)
    console.log('🚫 Step 6: Admin attempts to assign third seat (should trigger buy seats)...');
    const assignResponse3 = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats/assign`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_teams_e2e_123')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        org_id: 'org_teams_e2e_123',
        email: 'thirdmember@teams-e2e.com',
        role: 'member'
      })
    });

    if (assignResponse3.status !== 402) {
      throw new Error(`Expected 402 for no seats available, got ${assignResponse3.status}`);
    }
    console.log('✅ Correctly blocked third seat assignment (no seats available)');

    // Step 7: Admin purchases additional seats (3 seats)
    console.log('🛒 Step 7: Admin purchases 3 additional seats...');
    const buySeatsResponse = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/buy-seats`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_teams_e2e_123')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orgId: 'org_teams_e2e_123',
        clerkUserId: testUsers[0].id,
        quantity: 3,
        successUrl: 'http://localhost:5173/payment-success',
        cancelUrl: 'http://localhost:5173/payment-cancelled'
      })
    });

    if (!buySeatsResponse.ok) {
      const errorData = await buySeatsResponse.json();
      throw new Error(`Failed to create checkout for additional seats: ${errorData.error}`);
    }

    const buySeatsData = await buySeatsResponse.json();
    console.log('✅ Checkout session created for 3 additional seats');

    // Simulate successful payment by updating subscription (in real scenario, this would be done by webhook)
    console.log('💳 Step 8: Simulating successful payment...');
    const { error: updateSeatsError } = await supabase
      .from('organization_subscriptions')
      .update({
        seats_total: 5, // 2 original + 3 purchased
        updated_at: new Date().toISOString()
      })
      .eq('id', orgSubId);

    if (updateSeatsError) throw updateSeatsError;
    console.log('✅ Subscription updated with 5 total seats');

    // Step 9: Admin assigns third seat (should now succeed)
    console.log('🎫 Step 9: Admin assigns third seat after payment...');
    const assignResponse3AfterPayment = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats/assign`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_teams_e2e_123')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        org_id: 'org_teams_e2e_123',
        email: 'thirdmember@teams-e2e.com',
        role: 'member'
      })
    });

    if (!assignResponse3AfterPayment.ok) {
      const errorData = await assignResponse3AfterPayment.json();
      throw new Error(`Failed to assign third seat after payment: ${errorData.error}`);
    }
    console.log('✅ Third seat assigned successfully after payment');

    // Step 10: Simulate team member using credits (member1 uses some credits)
    console.log('⚡ Step 10: Simulating team member credit usage...');
    // In a real scenario, this would happen through API usage
    const { error: useCreditsError } = await supabase
      .from('users')
      .update({ credits: 400 }) // Simulate using 100 credits
      .eq('clerk_id', testUsers[1].id);

    if (useCreditsError) throw useCreditsError;
    console.log('✅ Member1 used 100 credits (500 → 400)');

    // Step 11: Admin revokes member2's seat (credit deallocation)
    console.log('🚫 Step 11: Admin revokes member2\'s seat...');
    const revokeResponse = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats/revoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_teams_e2e_123')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        org_id: 'org_teams_e2e_123',
        user_id: testUsers[2].id
      })
    });

    if (!revokeResponse.ok) {
      const errorData = await revokeResponse.json();
      throw new Error(`Failed to revoke seat: ${errorData.error}`);
    }
    console.log('✅ Member2\'s seat revoked');

    // Verify member2's credits were deallocated (should be back to starter plan: 25)
    const { data: member2CreditsAfterRevoke, error: member2RevokeError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', testUsers[2].id)
      .single();

    if (member2RevokeError) throw member2RevokeError;
    console.log(`💰 Member2 credits after revocation: ${member2CreditsAfterRevoke.credits} (should be 25 for starter plan)`);

    // Step 12: Verify final seat counts
    console.log('📊 Step 12: Verifying final seat counts...');
    const finalSeatsResponse = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats?org_id=org_teams_e2e_123`, {
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_teams_e2e_123')}`,
        'Content-Type': 'application/json'
      }
    });

    const finalSeatsData = await finalSeatsResponse.json();
    console.log('📊 Final seat status:', {
      seats_used: finalSeatsData.seats_used,
      seats_total: finalSeatsData.seats_total,
      available_seats: finalSeatsData.seats_total - finalSeatsData.seats_used
    });

    if (finalSeatsData.seats_used !== 2 || finalSeatsData.seats_total !== 5) {
      throw new Error(`Expected 2/5 seats used, got ${finalSeatsData.seats_used}/${finalSeatsData.seats_total}`);
    }

    // Step 13: Test billing frequency change (monthly to yearly)
    console.log('📅 Step 13: Testing billing frequency change to yearly...');
    const { error: yearlyUpdateError } = await supabase
      .from('organization_subscriptions')
      .update({ billing_frequency: 'yearly' })
      .eq('id', orgSubId);

    if (yearlyUpdateError) throw yearlyUpdateError;

    // Assign a new seat with yearly credits
    const yearlyAssignResponse = await fetch(`${process.env.VITE_API_URL || 'http://localhost:3001'}/api/organizations/seats/assign`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${generateMockToken(testUsers[0].id, 'org_teams_e2e_123')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        org_id: 'org_teams_e2e_123',
        email: 'yearlymember@teams-e2e.com',
        role: 'member'
      })
    });

    if (!yearlyAssignResponse.ok) {
      const errorData = await yearlyAssignResponse.json();
      throw new Error(`Failed to assign yearly seat: ${errorData.error}`);
    }

    // Verify yearly credits (6000 for yearly teams plan)
    const { data: yearlyCreditsData, error: yearlyCreditsError } = await supabase
      .from('users')
      .select('credits')
      .eq('email', 'yearlymember@teams-e2e.com')
      .single();

    if (yearlyCreditsError) throw yearlyCreditsError;
    if (yearlyCreditsData.credits !== 6000) {
      throw new Error(`Yearly member should have 6000 credits, got ${yearlyCreditsData.credits}`);
    }
    console.log('💰 Yearly member received 6000 credits');

    console.log('🎉 Teams plan end-to-end test PASSED!');

    // Clean up
    console.log('🧹 Cleaning up test data...');

    const { error: deleteOrgError } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId);

    // Get all test users including the yearly one
    const { data: allTestUsers } = await supabase
      .from('users')
      .select('id')
      .in('email', [
        'admin@teams-e2e.com',
        'member1@teams-e2e.com',
        'member2@teams-e2e.com',
        'thirdmember@teams-e2e.com',
        'yearlymember@teams-e2e.com'
      ]);

    if (allTestUsers) {
      for (const user of allTestUsers) {
        await supabase.from('users').delete().eq('id', user.id);
      }
    }

    if (deleteOrgError) console.error('Error deleting org:', deleteOrgError);

    console.log('✅ Teams plan end-to-end test completed successfully!');

  } catch (err) {
    console.error('❌ Teams plan end-to-end test failed:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

testTeamsPlanEndToEnd();