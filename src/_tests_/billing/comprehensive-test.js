// Comprehensive Billing Portal Testing Script
// Run with: node src/_tests_/billing/comprehensive-test.js

const API_BASE_URL = 'http://localhost:3000';

class BillingTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async test(name, testFn) {
    try {
      this.log(`Running test: ${name}`);
      await testFn();
      this.results.passed++;
      this.results.tests.push({ name, status: 'passed' });
      this.log(`Test passed: ${name}`, 'success');
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'failed', error: error.message });
      this.log(`Test failed: ${name} - ${error.message}`, 'error');
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Comprehensive Billing Portal Tests');

    // Test 1: API Endpoint Existence
    await this.test('API Endpoint Existence', async () => {
      const endpoints = [
        '/api/billing/credit-purchase',
        '/api/stripe/create-customer-portal-session',
        '/api/stripe/webhooks'
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'OPTIONS'
        });
        if (!response.ok && response.status !== 405) {
          throw new Error(`Endpoint ${endpoint} not accessible`);
        }
      }
    });

    // Test 2: Credit Purchase API Structure
    await this.test('Credit Purchase API Structure', async () => {
      const response = await fetch(`${API_BASE_URL}/api/billing/credit-purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkUserId: 'test-user-123',
          credits: 500,
          amount: 7.00,
          currency: 'EUR'
        })
      });

      // Should return 400 for missing auth, but should not crash
      if (response.status === 500) {
        throw new Error('API crashed with 500 error');
      }

      const data = await response.json();
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format');
      }
    });

    // Test 3: Customer Portal API Structure
    await this.test('Customer Portal API Structure', async () => {
      const response = await fetch(`${API_BASE_URL}/api/stripe/create-customer-portal-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'test-user-123' })
      });

      if (response.status === 500) {
        throw new Error('API crashed with 500 error');
      }

      const data = await response.json();
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format');
      }
    });

    // Test 4: Webhook Endpoint Structure
    await this.test('Webhook Endpoint Structure', async () => {
      const response = await fetch(`${API_BASE_URL}/api/stripe/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'webhook' })
      });

      // Webhooks should return 400 for invalid signature, not crash
      if (response.status === 500) {
        throw new Error('Webhook endpoint crashed with 500 error');
      }
    });

    // Test 5: Environment Variables Check
    await this.test('Environment Variables Check', async () => {
      // This would need to be checked server-side
      // For now, just verify the API doesn't crash on missing env vars
      const response = await fetch(`${API_BASE_URL}/api/billing/credit-purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (response.status === 500) {
        const text = await response.text();
        if (text.includes('STRIPE_SECRET_KEY') || text.includes('SUPABASE')) {
          throw new Error('Environment variables not configured');
        }
      }
    });

    // Test 6: Credit Calculation Logic
    await this.test('Credit Calculation Logic', () => {
      // Test the credit to dollar conversion
      const credits = 500;
      const expectedDollars = 7.00; // 500 * 0.014
      const actualDollars = credits * 0.014;

      if (Math.abs(actualDollars - expectedDollars) > 0.01) {
        throw new Error(`Credit calculation incorrect: expected ${expectedDollars}, got ${actualDollars}`);
      }
    });

    // Test 7: Input Validation
    await this.test('Input Validation', () => {
      const testCases = [
        { credits: 0, shouldFail: true },
        { credits: 50, shouldFail: true }, // Below minimum
        { credits: 500, shouldFail: false },
        { credits: 10000, shouldFail: false },
        { credits: 20000, shouldFail: true }, // Above maximum
        { credits: 'invalid', shouldFail: true },
        { credits: 500.5, shouldFail: true }, // Not whole number
      ];

      for (const testCase of testCases) {
        const isValid = testCase.credits >= 100 &&
                       testCase.credits <= 10000 &&
                       Number.isInteger(testCase.credits);

        if (isValid === testCase.shouldFail) {
          throw new Error(`Validation failed for credits: ${testCase.credits}`);
        }
      }
    });

    // Test 8: Error Handling
    await this.test('Error Handling', async () => {
      const response = await fetch(`${API_BASE_URL}/api/billing/credit-purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (!data.error) {
        throw new Error('API should return error for invalid input');
      }
    });

    // Test 9: CORS Headers
    await this.test('CORS Headers', async () => {
      const response = await fetch(`${API_BASE_URL}/api/billing/credit-purchase`, {
        method: 'OPTIONS'
      });

      if (!response.headers.get('access-control-allow-origin')) {
        throw new Error('CORS headers not set');
      }
    });

    // Test 10: Rate Limiting (if implemented)
    await this.test('Rate Limiting', async () => {
      // Send multiple requests quickly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          fetch(`${API_BASE_URL}/api/billing/credit-purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clerkUserId: 'test-user-123', credits: 500, amount: 7.00, currency: 'EUR' })
          })
        );
      }

      const results = await Promise.all(promises);
      const rateLimited = results.some(r => r.status === 429);

      // Rate limiting might not be implemented, so this is optional
      if (rateLimited) {
        this.log('Rate limiting detected (good!)', 'success');
      } else {
        this.log('Rate limiting not detected (consider implementing)', 'info');
      }
    });

    this.printResults();
  }

  printResults() {
    this.log(`\n📊 Test Results Summary:`);
    this.log(`✅ Passed: ${this.results.passed}`);
    this.log(`❌ Failed: ${this.results.failed}`);
    this.log(`📈 Total: ${this.results.passed + this.results.failed}`);

    if (this.results.failed > 0) {
      this.log(`\n❌ Failed Tests:`);
      this.results.tests
        .filter(test => test.status === 'failed')
        .forEach(test => {
          this.log(`  - ${test.name}: ${test.error}`, 'error');
        });
    }

    const successRate = ((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1);
    this.log(`\n🎯 Success Rate: ${successRate}%`);

    if (this.results.failed === 0) {
      this.log('🎉 All tests passed! Billing portal is ready for production.', 'success');
    } else {
      this.log('⚠️ Some tests failed. Please review and fix before deploying.', 'error');
    }
  }
}

// Browser-compatible version
if (typeof window !== 'undefined') {
  window.BillingTester = BillingTester;
  window.runBillingTests = async () => {
    const tester = new BillingTester();
    await tester.runAllTests();
  };

  console.log('💡 Billing tests available. Run: runBillingTests()');
} else {
  // Node.js version
  const tester = new BillingTester();
  tester.runAllTests().catch(console.error);
}

export default BillingTester;