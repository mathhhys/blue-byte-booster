describe('Dashboard Top-up E2E Tests', () => {
  beforeEach(() => {
    // Mock Clerk auth to simulate signed-in user
    cy.intercept('GET', '**/v1/client?*', {
      fixture: 'clerk-authenticated.json' // Assume fixture with signed-in state; create if needed
    }).as('clerkAuth');

    // Mock initial user data
    cy.intercept('GET', '/api/user/get', {
      body: {
        data: {
          id: 'test-user-123',
          clerk_id: 'test-user-123',
          email: 'test@example.com',
          credits: 1250,
          plan_type: 'starter'
        },
        error: null
      }
    }).as('getUserInitial');

    // Mock successful purchase
    cy.intercept('POST', '/api/billing/credit-purchase', {
      body: {
        success: true,
        sessionId: 'test-session-123',
        url: '/payment-success' // Mock redirect to local success page
      }
    }).as('creditPurchase');

    // Mock updated user data after success
    cy.intercept('GET', '/api/user/get', (req) => {
      return {
        body: {
          data: {
            id: 'test-user-123',
            clerk_id: 'test-user-123',
            email: 'test@example.com',
            credits: 1750, // Updated after top-up
            plan_type: 'starter'
          },
          error: null
        }
      };
    }).as('getUserUpdated');

    // Mock success page refetch
    cy.intercept('GET', '/payment-success', {
      fixture: null // Or handle if needed
    });

    cy.visit('/dashboard');
    cy.wait('@clerkAuth');
    cy.wait('@getUserInitial');
  });

  it('TC-IND-E2E-01: Successfully tops up credits and verifies update', () => {
    // Assert initial credits
    cy.contains('1,250').should('be.visible');
    cy.contains('Available Credits').should('be.visible');

    // Interact with form
    cy.get('[placeholder="500"]').type('500');
    cy.get('button:has-text("Add Credits")').click();

    // Wait for purchase intercept
    cy.wait('@creditPurchase').then((interception) => {
      expect(interception.request.body).to.deep.equal({
        clerkUserId: 'test-user-123',
        credits: 500,
        amount: 7,
        currency: 'EUR'
      });
    });

    // Simulate Stripe redirect by visiting success page
    cy.visit('/payment-success');
    cy.wait('@getUserUpdated');

    // Assert updated credits
    cy.contains('1,750').should('be.visible');
    cy.contains('Available Credits').should('be.visible');

    // No error messages
    cy.contains(/error/i).should('not.exist');
  });

  it('TC-IND-E2E-03: Prevents submit with invalid input', () => {
    // Invalid input below min
    cy.get('[placeholder="500"]').type('100');
    cy.get('button:has-text("Add Credits")').click();

    // Should show validation error, no API call
    cy.contains(/Minimum purchase is 500 credits/).should('be.visible');
    cy.wait('@creditPurchase').should('not.exist'); // No call

    // Non-numeric
    cy.get('[placeholder="500"]').clear().type('abc');
    cy.get('button:has-text("Add Credits")').click();
    cy.contains(/Please enter a valid number/).should('be.visible');
  });

  it('TC-IND-E2E-05: Handles max credits input', () => {
    cy.get('[placeholder="500"]').type('10000');
    cy.contains('Cost: $140.00').should('be.visible'); // Approx conversion

    // Over max
    cy.get('[placeholder="500"]').type('10001');
    cy.contains(/Maximum purchase is 10,000 credits/).should('be.visible');
  });

  it('TC-IND-IT-03: Simulates webhook via success refetch', () => {
    // Perform top-up
    cy.get('[placeholder="500"]').type('500');
    cy.get('button:has-text("Add Credits")').click();
    cy.wait('@creditPurchase');

    cy.visit('/payment-success');
    cy.wait('@getUserUpdated');

    // Verify credits updated (webhook implied by DB update)
    cy.contains('1,750').should('be.visible');
  });
});