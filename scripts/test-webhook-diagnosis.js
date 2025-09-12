import crypto from 'crypto';

// Function to test environment variable availability
async function testEnvironmentVariables(url) {
  console.log(`🔍 Testing environment variables for: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET', // Use GET to avoid signature verification
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const responseText = await response.text();
    console.log(`📥 GET Response status: ${response.status}`);
    console.log(`📥 GET Response:`, responseText);
    
    return {
      status: response.status,
      body: responseText,
      available: response.status !== 404
    };
    
  } catch (error) {
    console.error('❌ Error testing endpoint:', error.message);
    return {
      error: error.message,
      available: false
    };
  }
}

// Function to test with minimal valid payload (to check env vars without signature issues)
async function testMinimalPayload(url) {
  console.log(`🧪 Testing minimal payload for: ${url}`);
  
  const minimalPayload = {
    type: 'test',
    data: { id: 'test' }
  };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // No Svix headers to isolate environment variable issues
      },
      body: JSON.stringify(minimalPayload)
    });
    
    const responseText = await response.text();
    console.log(`📥 POST Response status: ${response.status}`);
    console.log(`📥 POST Response:`, responseText);
    
    return {
      status: response.status,
      body: responseText
    };
    
  } catch (error) {
    console.error('❌ Error testing minimal payload:', error.message);
    return {
      error: error.message
    };
  }
}

async function runDiagnostics() {
  console.log('🚀 Starting webhook diagnostics...\n');
  
  const endpoints = [
    'https://www.softcodes.ai/api/clerk/webhooks',
    'https://www.softcodes.ai/api/webhooks/clerk'
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\n=== Diagnosing ${endpoint} ===`);
    
    // Test if endpoint exists
    const envTest = await testEnvironmentVariables(endpoint);
    console.log(`Endpoint available: ${envTest.available ? '✅' : '❌'}`);
    
    if (envTest.available) {
      // Test with minimal payload to check for environment variable issues
      const payloadTest = await testMinimalPayload(endpoint);
      
      // Analyze response to understand the issue
      if (payloadTest.status === 500 && payloadTest.body.includes('not set')) {
        console.log('🔍 DIAGNOSIS: Missing environment variables');
      } else if (payloadTest.status === 400 && payloadTest.body.includes('Svix')) {
        console.log('🔍 DIAGNOSIS: Missing Svix headers (expected for signature verification)');
      } else if (payloadTest.status === 405) {
        console.log('🔍 DIAGNOSIS: Method not allowed (GET test failed, but endpoint exists)');
      }
    }
  }
  
  console.log('\n📊 Diagnostic Summary:');
  console.log('- /api/clerk/webhooks uses CLERK_WEBHOOK_SIGNING_SECRET');
  console.log('- /api/webhooks/clerk uses CLERK_WEBHOOK_SECRET'); 
  console.log('- Check if both environment variables are set in production');
}

runDiagnostics().catch(console.error);