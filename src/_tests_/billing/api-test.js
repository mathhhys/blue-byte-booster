// Manual API testing script for billing endpoints
// Run with: node src/_tests_/billing/api-test.js

const API_BASE_URL = 'http://localhost:3000';

async function testCreditPurchaseAPI() {
  console.log('=== Testing Credit Purchase API ===');
  
  const testPayload = {
    clerkUserId: 'test-user-123',
    credits: 500,
    amount: 7.00,
    currency: 'EUR'
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/billing/credit-purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log('Response Status:', response.status);
    console.log('Response OK:', response.ok);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success Response:', data);
      
      if (data.url) {
        console.log('✅ Checkout URL generated:', data.url);
      } else {
        console.log('❌ No checkout URL in response');
      }
    } else {
      const errorData = await response.json();
      console.log('❌ Error Response:', errorData);
    }
  } catch (error) {
    console.log('❌ Network Error:', error.message);
  }
}

async function testWebhookEndpoint() {
  console.log('\n=== Testing Webhook Endpoint ===');
  
  const mockWebhookEvent = {
    id: 'evt_test_webhook',
    object: 'event',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_test_123',
        customer: 'cus_test_123',
        metadata: {
          clerk_user_id: 'test-user-123',
          credits: '500',
          purchase_type: 'credit_purchase'
        }
      }
    }
  };

  try {
    console.log('Note: Webhook testing requires proper Stripe signature headers');
    console.log('Mock event structure:', JSON.stringify(mockWebhookEvent, null, 2));
    console.log('For full webhook testing, use Stripe CLI: stripe listen --forward-to localhost:3000/api/stripe/webhooks');
  } catch (error) {
    console.log('❌ Webhook Test Error:', error.message);
  }
}

// Run tests
if (typeof window === 'undefined') {
  // Node.js environment
  testCreditPurchaseAPI().then(() => {
    testWebhookEndpoint();
  });
} else {
  // Browser environment
  console.log('Use browser console to run: testCreditPurchaseAPI()');
  window.testCreditPurchaseAPI = testCreditPurchaseAPI;
  window.testWebhookEndpoint = testWebhookEndpoint;
}