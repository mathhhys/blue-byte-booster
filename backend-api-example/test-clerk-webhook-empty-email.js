const crypto = require('crypto');
const fetch = require('node-fetch');
require('dotenv').config();

// Test Clerk webhook with empty email_addresses array (real scenario)
async function testClerkWebhookEmptyEmail() {
  const webhookSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET || 'whsec_sio9isQCN+JanDpOFeIURMzrR3XERoFb';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const id = 'msg_test_' + Date.now();
  
  // Create a test payload matching the real webhook structure with empty email_addresses
  const payload = JSON.stringify({
    data: {
      backup_code_enabled: false,
      banned: false,
      create_organization_enabled: true,
      create_organizations_limit: null,
      created_at: 1716883200000,
      delete_self_enabled: true,
      email_addresses: [], // Empty array like in real webhook
      enterprise_accounts: [],
      external_accounts: [],
      external_id: null,
      first_name: 'John',
      has_image: true,
      id: 'user_2g7np7Hrk0SN6kj5EDMLDaKNL0S',
      image_url: 'https://img.clerk.com/xxxxxx',
      last_active_at: 1716883200000,
      last_name: 'Doe',
      last_sign_in_at: 1716883200000,
      legal_accepted_at: 1716883200000,
      locked: false,
      lockout_expires_in_seconds: null,
      mfa_disabled_at: null,
      mfa_enabled_at: null,
      object: 'user',
      passkeys: [],
      password_enabled: true,
      phone_numbers: [],
      primary_email_address_id: 'idn_2g7np7Hrk0SN6kj5EDMLDaKNL0S', // Has ID but no email data
      primary_phone_number_id: null,
      primary_web3_wallet_id: null,
      private_metadata: null,
      profile_image_url: 'https://img.clerk.com/xxxxxx',
      public_metadata: {},
      saml_accounts: [],
      totp_enabled: false,
      two_factor_enabled: false,
      unsafe_metadata: {},
      updated_at: 1716883200000,
      username: null,
      verification_attempts_remaining: null,
      web3_wallets: []
    },
    type: 'user.created'
  });

  // Create Svix signature
  const secretKey = webhookSecret.replace('whsec_', '');
  const secretBytes = Buffer.from(secretKey, 'base64');
  const toSign = `${id}.${timestamp}.${payload}`;
  const signature = crypto.createHmac('sha256', secretBytes).update(toSign, 'utf8').digest('base64');

  console.log('Testing Clerk webhook with empty email_addresses array...');
  console.log('User ID:', 'user_2g7np7Hrk0SN6kj5EDMLDaKNL0S');
  console.log('Primary email ID:', 'idn_2g7np7Hrk0SN6kj5EDMLDaKNL0S');
  console.log('Email addresses length:', 0);

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
      console.log('✅ Webhook test with empty email array passed!');
    } else {
      console.log('❌ Webhook test with empty email array failed');
    }
  } catch (error) {
    console.error('Error testing webhook:', error.message);
  }
}

testClerkWebhookEmptyEmail();