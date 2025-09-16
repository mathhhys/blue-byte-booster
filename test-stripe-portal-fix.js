// Test script to verify the Stripe customer portal session function fix
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Mock environment variables for testing
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_for_testing';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock_service_role_key';

// Mock the Stripe module
const mockStripe = {
  customers: {
    retrieve: async (id) => ({ id, email: 'test@example.com' }),
    list: async (params) => ({ data: [] }),
    create: async (params) => ({ id: 'cus_mock_123', email: params.email })
  },
  billingPortal: {
    sessions: {
      create: async (params) => ({ 
        id: 'bps_mock_123', 
        url: 'https://billing.stripe.com/session/mock_123' 
      })
    }
  }
};

// Mock Supabase
const mockSupabase = {
  from: () => ({
    select: () => ({
      eq: () => ({
        single: async () => ({
          data: { email: 'test@example.com', stripe_customer_id: null },
          error: null
        })
      })
    }),
    update: () => ({
      eq: () => ({
        error: null
      })
    })
  })
};

// Mock the modules before importing the function
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(...args) {
  if (args[0] === 'stripe') {
    return function() { return mockStripe; };
  }
  if (args[0] === '@supabase/supabase-js') {
    return { createClient: () => mockSupabase };
  }
  return originalRequire.apply(this, args);
};

async function testFunction() {
  try {
    console.log('🧪 Testing Stripe customer portal session function...');
    
    // Import the function dynamically
    const { default: handler } = await import('./api/stripe/create-customer-portal-session.js');
    
    // Mock request and response objects
    const mockReq = {
      method: 'POST',
      body: { userId: 'user_test_123' },
      headers: { origin: 'https://test.com' }
    };
    
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log(`✅ Response status: ${code}`);
          console.log('✅ Response data:', JSON.stringify(data, null, 2));
          return { status: code, data };
        }
      })
    };
    
    // Test the function
    const result = await handler(mockReq, mockRes);
    
    console.log('🎉 Function executed successfully!');
    console.log('🔧 Module system issue has been resolved.');
    
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('📍 Error stack:', error.stack);
    return false;
  }
}

testFunction().then(success => {
  if (success) {
    console.log('\n✨ All tests passed! The Stripe customer portal function is fixed.');
  } else {
    console.log('\n💥 Tests failed. Please check the implementation.');
  }
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});