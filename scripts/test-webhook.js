/**
 * Test script for Clerk webhook functionality
 * Run this after setting up your webhook to verify it's working correctly
 */

const crypto = require('crypto');

// Test webhook payload - simulates a user.created event
const testPayload = {
  data: {
    id: 'user_test123',
    email_addresses: [
      {
        id: 'email_test123',
        email_address: 'test@example.com'
      }
    ],
    primary_email_address_id: 'email_test123',
    first_name: 'Test',
    last_name: 'User',
    image_url: 'https://example.com/avatar.png'
  },
  type: 'user.created',
  object: 'event'
};

// Function to create Svix signature for testing
function createSvixSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const id = 'msg_test123';
  
  const toSign = `${id}.${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto.createHmac('sha256', secret.split('_')[1])
    .update(toSign, 'utf8')
    .digest('base64');
  
  return {
    'svix-id': id,
    'svix-timestamp': timestamp.toString(),
    'svix-signature': `v1,${signature}`
  };
}

// Test function
async function testWebhook() {
  const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks';
  const webhookSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  
  if (!webhookSecret) {
    console.error('❌ CLERK_WEBHOOK_SIGNING_SECRET not found in environment variables');
    console.log('Please set your webhook signing secret:');
    console.log('export CLERK_WEBHOOK_SIGNING_SECRET=whsec_your_secret_here');
    return;
  }
  
  console.log('🧪 Testing webhook at:', webhookUrl);
  console.log('📦 Payload:', JSON.stringify(testPayload, null, 2));
  
  try {
    const headers = createSvixSignature(testPayload, webhookSecret);
    
    console.log('🔐 Headers:', headers);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(testPayload)
    });
    
    const responseText = await response.text();
    
    if (response.ok) {
      console.log('✅ Webhook test successful!');
      console.log('📤 Response:', response.status, responseText);
    } else {
      console.log('❌ Webhook test failed!');
      console.log('📤 Response:', response.status, responseText);
    }
    
  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
    console.log('💡 Make sure your development server is running on the correct port');
  }
}

// Run the test
if (require.main === module) {
  testWebhook();
}

module.exports = { testWebhook, createSvixSignature };