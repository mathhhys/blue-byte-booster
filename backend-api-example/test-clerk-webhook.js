const crypto = require('crypto');
const fetch = require('node-fetch');
require('dotenv').config();

// Test Clerk webhook with proper Svix signature
async function testClerkWebhook() {
  const webhookSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET || 'whsec_sio9isQCN+JanDpOFeIURMzrR3XERoFb';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const id = 'msg_test_' + Date.now();
  
  // Create a test payload
  const payload = JSON.stringify({
    data: {
      id: 'user_test123',
      first_name: 'Test',
      last_name: 'User',
      email_addresses: [{
        id: 'email_test',
        email_address: 'test@example.com'
      }],
      primary_email_address_id: 'email_test',
      image_url: 'https://example.com/avatar.jpg'
    },
    type: 'user.created'
  });

  // Create Svix signature
  const secretKey = webhookSecret.replace('whsec_', '');
  const secretBytes = Buffer.from(secretKey, 'base64');
  const toSign = `${id}.${timestamp}.${payload}`;
  const signature = crypto.createHmac('sha256', secretBytes).update(toSign, 'utf8').digest('base64');

  console.log('Testing Clerk webhook...');
  console.log('Payload:', payload.substring(0, 100) + '...');
  console.log('Signature:', signature);

  try {
    const response = await fetch('http://localhost:3001/api/clerk/webhooks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'svix-id': id,
        'svix-timestamp': timestamp,
        'svix-signature': `v1,${signature}`
      },
      body: payload
    });

    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', result);
    
    if (response.status === 200) {
      console.log('✅ Webhook test passed!');
    } else {
      console.log('❌ Webhook test failed');
    }
  } catch (error) {
    console.error('Error testing webhook:', error.message);
  }
}

testClerkWebhook();