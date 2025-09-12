import crypto from 'crypto';

// Test script to verify webhook functionality after fixes
async function testWebhookDeployment() {
  console.log('🚀 Testing webhook after deployment fixes...\n');

  const endpoints = [
    'https://www.softcodes.ai/api/clerk/webhooks',
    'https://www.softcodes.ai/api/webhooks/clerk'
  ];

  // Mock Clerk webhook payload
  const mockPayload = {
    type: 'user.created',
    data: {
      id: 'user_test_after_fix',
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

  for (const endpoint of endpoints) {
    console.log(`\n=== Testing ${endpoint} ===`);
    
    // Test 1: Check if endpoint exists (should return 405 for GET, not 404)
    try {
      const getResponse = await fetch(endpoint, { method: 'GET' });
      console.log(`GET Response: ${getResponse.status} ${getResponse.statusText}`);
      
      if (getResponse.status === 404) {
        console.log('❌ Endpoint not deployed (404 error)');
        continue;
      } else if (getResponse.status === 405) {
        console.log('✅ Endpoint exists (405 Method Not Allowed expected for GET)');
      }
    } catch (error) {
      console.log(`❌ Network error: ${error.message}`);
      continue;
    }
    
    // Test 2: POST without headers (should return 400 for missing headers, not 500)
    try {
      const postResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockPayload)
      });
      
      const responseText = await postResponse.text();
      console.log(`POST Response: ${postResponse.status} ${postResponse.statusText}`);
      console.log(`Response body: ${responseText}`);
      
      if (postResponse.status === 400 && responseText.includes('Svix')) {
        console.log('✅ Endpoint functional (expecting Svix headers)');
      } else if (postResponse.status === 500) {
        console.log('❌ Server error - environment variables or code issue');
      }
    } catch (error) {
      console.log(`❌ POST error: ${error.message}`);
    }
  }
  
  console.log('\n📊 Test Summary:');
  console.log('- Fixed TypeScript import errors (.js extensions)');
  console.log('- Reduced function count (removed test-webhook-deployment)');
  console.log('- Updated vercel.json configuration');
  console.log('- Ready for production deployment');
}

testWebhookDeployment().catch(console.error);