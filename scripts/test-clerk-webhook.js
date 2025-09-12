import crypto from 'crypto';

// Mock Clerk webhook payload
const mockPayload = {
  type: 'user.created',
  data: {
    id: 'user_test123',
    first_name: 'Test',
    last_name: 'User',
    email_addresses: [
      {
        id: 'email_test123',
        email_address: 'test@example.com'
      }
    ],
    primary_email_address_id: 'email_test123',
    image_url: 'https://example.com/avatar.jpg',
    created_at: Date.now(),
    updated_at: Date.now()
  }
};

// Function to generate mock Svix headers (for testing without real signature)
function generateMockSvixHeaders(payload) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const id = `msg_${crypto.randomBytes(16).toString('hex')}`;
  // For testing, we'll use a mock signature
  const signature = `v1,${crypto.randomBytes(32).toString('base64')}`;
  
  return {
    'svix-id': id,
    'svix-timestamp': timestamp,
    'svix-signature': signature
  };
}

async function testWebhook(url) {
  console.log(`🧪 Testing webhook at: ${url}`);
  
  const payloadString = JSON.stringify(mockPayload);
  const headers = generateMockSvixHeaders(payloadString);
  
  console.log('📤 Sending payload:', JSON.stringify(mockPayload, null, 2));
  console.log('📤 Svix headers:', headers);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: payloadString
    });
    
    const responseText = await response.text();
    
    console.log(`📥 Response status: ${response.status}`);
    console.log(`📥 Response headers:`, Object.fromEntries(response.headers.entries()));
    console.log(`📥 Response body:`, responseText);
    
    if (response.ok) {
      console.log('✅ Webhook test successful!');
    } else {
      console.log('❌ Webhook test failed!');
    }
    
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseText,
      success: response.ok
    };
    
  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
    return {
      error: error.message,
      success: false
    };
  }
}

// Test both endpoints
async function runTests() {
  console.log('🚀 Starting webhook tests...\n');
  
  // Test the new endpoint
  console.log('=== Testing /api/clerk/webhooks ===');
  const result1 = await testWebhook('https://www.softcodes.ai/api/clerk/webhooks');
  
  console.log('\n=== Testing /api/webhooks/clerk ===');
  const result2 = await testWebhook('https://www.softcodes.ai/api/webhooks/clerk');
  
  console.log('\n=== Testing /api/test-webhook-deployment ===');
  const result3 = await testWebhook('https://www.softcodes.ai/api/test-webhook-deployment');
  
  console.log('\n📊 Test Summary:');
  console.log(`/api/clerk/webhooks: ${result1.success ? '✅' : '❌'} (${result1.status || 'ERROR'})`);
  console.log(`/api/webhooks/clerk: ${result2.success ? '✅' : '❌'} (${result2.status || 'ERROR'})`);
  console.log(`/api/test-webhook-deployment: ${result3.success ? '✅' : '❌'} (${result3.status || 'ERROR'})`);
}

// Run the tests
runTests().catch(console.error);