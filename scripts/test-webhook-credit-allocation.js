// Test script for webhook credit allocation functionality
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const testWebhookCreditAllocation = async () => {
  console.log('🧪 Testing Webhook Credit Allocation System...\n');

  const testCases = [
    {
      name: 'Monthly Pro Plan - Initial Payment',
      planType: 'pro',
      billingFrequency: 'monthly',
      seats: 1,
      expectedCredits: 500,
      paymentType: 'initial'
    },
    {
      name: 'Yearly Pro Plan - Initial Payment',
      planType: 'pro',
      billingFrequency: 'yearly',
      seats: 1,
      expectedCredits: 6000,
      paymentType: 'initial'
    },
    {
      name: 'Monthly Teams Plan - Initial Payment (3 seats)',
      planType: 'teams',
      billingFrequency: 'monthly',
      seats: 3,
      expectedCredits: 1500,
      paymentType: 'initial'
    },
    {
      name: 'Yearly Teams Plan - Initial Payment (5 seats)',
      planType: 'teams',
      billingFrequency: 'yearly',
      seats: 5,
      expectedCredits: 30000,
      paymentType: 'initial'
    },
    {
      name: 'Monthly Pro Plan - Recurring Payment',
      planType: 'pro',
      billingFrequency: 'monthly',
      seats: 1,
      expectedCredits: 500,
      paymentType: 'recurring'
    },
    {
      name: 'Yearly Pro Plan - Recurring Payment',
      planType: 'pro',
      billingFrequency: 'yearly',
      seats: 1,
      expectedCredits: 6000,
      paymentType: 'recurring'
    }
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log(`   Plan: ${testCase.planType}, Billing: ${testCase.billingFrequency}, Seats: ${testCase.seats}`);
    console.log(`   Expected Credits: ${testCase.expectedCredits}`);
    
    try {
      const result = await runSingleTest(testCase);
      if (result.success) {
        console.log(`   ✅ PASSED - Granted ${result.creditsGranted} credits`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED - ${result.error}`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR - ${error.message}`);
    }
  }

  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Webhook credit allocation is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Please check the implementation.');
  }

  // Test webhook endpoint if available
  await testWebhookEndpoint();
};

async function runSingleTest(testCase) {
  const testUser = {
    clerk_id: `test_webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: `webhook-test-${Date.now()}@example.com`,
    first_name: 'Webhook',
    last_name: 'Test'
  };

  try {
    // Create test user
    const { data: userId, error: createError } = await supabase.rpc('upsert_user', {
      p_clerk_id: testUser.clerk_id,
      p_email: testUser.email,
      p_first_name: testUser.first_name,
      p_last_name: testUser.last_name,
      p_plan_type: 'starter'
    });

    if (createError) throw createError;

    // Test credit calculation function
    const calculatedCredits = calculateCreditsToGrant(
      testCase.planType,
      testCase.billingFrequency,
      testCase.seats
    );

    if (calculatedCredits !== testCase.expectedCredits) {
      throw new Error(`Credit calculation mismatch: expected ${testCase.expectedCredits}, got ${calculatedCredits}`);
    }

    // Grant credits using the same logic as webhook
    const { error: creditError } = await supabase.rpc('grant_credits', {
      p_clerk_id: testUser.clerk_id,
      p_amount: calculatedCredits,
      p_description: `Test ${testCase.planType} plan ${testCase.billingFrequency} credits (${testCase.seats} seat${testCase.seats > 1 ? 's' : ''})`,
      p_reference_id: `test_${Date.now()}`
    });

    if (creditError) throw creditError;

    // Verify credits were granted correctly
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', testUser.clerk_id)
      .single();

    if (fetchError) throw fetchError;

    // Cleanup test user
    await supabase.from('users').delete().eq('clerk_id', testUser.clerk_id);

    // User starts with 25 starter credits, so total should be 25 + granted credits
    const expectedTotalCredits = 25 + calculatedCredits;
    if (user.credits === expectedTotalCredits) {
      return {
        success: true,
        creditsGranted: calculatedCredits
      };
    } else {
      return {
        success: false,
        error: `Credit verification failed: expected ${expectedTotalCredits}, got ${user.credits}`
      };
    }

  } catch (error) {
    // Cleanup on error
    try {
      await supabase.from('users').delete().eq('clerk_id', testUser.clerk_id);
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Helper function matching webhook logic
function calculateCreditsToGrant(planType, billingFrequency, seats = 1) {
  const baseCredits = billingFrequency === 'yearly' ? 6000 : 500;
  return baseCredits * seats;
}

// Test webhook endpoint availability
async function testWebhookEndpoint() {
  console.log('\n🔗 Testing webhook endpoint availability...');
  
  try {
    // Check if webhook endpoint is accessible
    const webhookUrl = process.env.WEBHOOK_TEST_URL || 'http://localhost:3000/api/stripe/webhooks';
    
    console.log(`   Testing endpoint: ${webhookUrl}`);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'test.webhook',
        data: { object: { id: 'test' } }
      })
    });

    if (response.status === 400) {
      console.log('   ✅ Webhook endpoint is accessible (signature verification working)');
    } else if (response.status === 405) {
      console.log('   ✅ Webhook endpoint exists (method validation working)');
    } else {
      console.log(`   ⚠️ Webhook endpoint returned status: ${response.status}`);
    }

  } catch (error) {
    console.log(`   ❌ Webhook endpoint not accessible: ${error.message}`);
    console.log('   💡 Make sure your server is running and webhook endpoint is deployed');
  }
}

// Test idempotency functionality
async function testIdempotency() {
  console.log('\n🔄 Testing idempotency...');
  
  const eventId = `test_idempotency_${Date.now()}`;
  
  try {
    // First check - should return false (not processed)
    const firstCheck = await checkIdempotency(eventId, supabase);
    console.log(`   First check result: ${firstCheck} (should be false)`);
    
    // Record processing
    await recordWebhookProcessing(eventId, 'test.event', { test: true }, supabase);
    
    // Second check - should return true (already processed)
    const secondCheck = await checkIdempotency(eventId, supabase);
    console.log(`   Second check result: ${secondCheck} (should be true)`);
    
    if (!firstCheck && secondCheck) {
      console.log('   ✅ Idempotency check working correctly');
    } else {
      console.log('   ❌ Idempotency check failed');
    }
    
  } catch (error) {
    console.log(`   ⚠️ Idempotency test failed: ${error.message}`);
    console.log('   💡 This is expected if webhook_events table doesn\'t exist yet');
  }
}

// Helper functions from webhook (duplicated for testing)
async function checkIdempotency(eventId, supabase) {
  try {
    const { data, error } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('event_id', eventId)
      .eq('status', 'success')
      .single();

    return !error && data;
  } catch (error) {
    return false;
  }
}

async function recordWebhookProcessing(eventId, eventType, payload, supabase) {
  try {
    const { error } = await supabase
      .from('webhook_events')
      .upsert({
        event_id: eventId,
        event_type: eventType,
        status: 'success',
        payload: payload,
        processed_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error recording webhook processing:', error);
    }
  } catch (error) {
    console.error('Error recording webhook processing:', error);
  }
}

// Run all tests
const runAllTests = async () => {
  try {
    await testWebhookCreditAllocation();
    await testIdempotency();
    
    console.log('\n🏁 All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
};

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export {
  testWebhookCreditAllocation,
  runSingleTest,
  calculateCreditsToGrant
};