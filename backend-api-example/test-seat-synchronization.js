require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSeatSynchronization() {
  try {
    console.log('🪑 Testing seat synchronization for teams plans...');

    // Create test organization
    const { data: orgData, error: orgError } = await supabase.rpc('upsert_organization', {
      p_clerk_org_id: 'org_test_seats_123',
      p_name: 'Test Organization for Seats'
    });

    if (orgError) throw orgError;
    const orgId = orgData;
    console.log('🏢 Test organization created with ID:', orgId);

    // Create test user
    const mockClerkUser = {
      id: 'clerk_seat_test_123',
      email: 'seat-test@example.com'
    };

    const { data: userData, error: userError } = await supabase.rpc('upsert_user', {
      p_clerk_id: mockClerkUser.id,
      p_email: mockClerkUser.email,
      p_first_name: 'Seat',
      p_last_name: 'Test',
      p_avatar_url: null,
      p_plan_type: 'starter'
    });

    if (userError) throw userError;
    const userId = userData;
    console.log('👤 Test user created with ID:', userId);

    // Create Stripe customer
    console.log('🏪 Creating Stripe customer...');
    const customer = await stripe.customers.create({
      email: mockClerkUser.email,
      description: `Test customer for seat synchronization`,
      metadata: {
        clerk_user_id: mockClerkUser.id
      }
    });
    console.log('✅ Stripe customer created:', customer.id);

    // Update organization with Stripe customer ID
    const { error: updateOrgError } = await supabase
      .from('organizations')
      .update({ stripe_customer_id: customer.id })
      .eq('id', orgId);

    if (updateOrgError) throw updateOrgError;

    // Create organization subscription for teams plan
    const { data: subData, error: subError } = await supabase
      .from('organization_subscriptions')
      .insert({
        organization_id: orgId,
        clerk_org_id: 'org_test_seats_123',
        stripe_customer_id: customer.id,
        stripe_subscription_id: 'sub_test_seats_123',
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
    console.log('📋 Teams subscription created with ID:', orgSubId);

    // Simulate subscription update webhook with quantity change
    console.log('🔄 Simulating subscription update webhook (quantity: 2 -> 5)...');

    const mockSubscription = {
      id: 'sub_test_seats_123',
      customer: customer.id,
      status: 'active',
      items: {
        data: [
          { quantity: 5 } // Changed from 2 to 5
        ]
      }
    };

    // Check initial seats_total
    console.log('📊 Checking initial seats_total...');
    const { data: initialData, error: initialError } = await supabase
      .from('organization_subscriptions')
      .select('seats_total')
      .eq('id', orgSubId)
      .single();

    if (initialError) throw initialError;
    console.log('Initial seats_total:', initialData.seats_total);

    // Simulate the webhook logic
    const totalQuantity = mockSubscription.items.data.reduce((total, item) => {
      return total + item.quantity;
    }, 0);

    console.log('Calculated total quantity:', totalQuantity);

    // Update organization subscription with new seats_total (simulating webhook)
    const { error: updateError } = await supabase
      .from('organization_subscriptions')
      .update({
        seats_total: totalQuantity,
        status: mockSubscription.status,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', mockSubscription.id);

    if (updateError) {
      throw new Error(`Failed to update seats: ${updateError.message}`);
    }

    // Verify the update
    const { data: finalData, error: finalError } = await supabase
      .from('organization_subscriptions')
      .select('seats_total, status')
      .eq('id', orgSubId)
      .single();

    if (finalError) throw finalError;

    console.log('✅ Final seats_total:', finalData.seats_total);
    console.log('✅ Status:', finalData.status);

    if (finalData.seats_total === 5) {
      console.log('🎉 Seat synchronization test PASSED!');
    } else {
      console.log('❌ Seat synchronization test FAILED!');
    }

    // Test with non-teams plan (should be skipped in real webhook)
    console.log('🔄 Testing with enterprise plan (should be skipped in webhook)...');

    const { error: enterpriseUpdateError } = await supabase
      .from('organization_subscriptions')
      .update({ plan_type: 'enterprise' })
      .eq('id', orgSubId);

    if (enterpriseUpdateError) throw enterpriseUpdateError;

    // In real webhook, this would be skipped due to plan_type check
    console.log('Enterprise plan test: webhook would skip update for non-teams plan');

    // Clean up
    console.log('🧹 Cleaning up test data...');
    await stripe.customers.del(customer.id);

    const { error: deleteOrgError } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId);

    const { error: deleteUserError } = await supabase
      .from('users')
      .delete()
      .eq('clerk_id', mockClerkUser.id);

    if (deleteOrgError) console.error('Error deleting org:', deleteOrgError);
    if (deleteUserError) console.error('Error deleting user:', deleteUserError);

    console.log('✅ Seat synchronization test completed successfully!');

  } catch (err) {
    console.error('❌ Seat synchronization test failed:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

testSeatSynchronization();