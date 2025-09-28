/// <reference types="cypress" />

// Import commands into your Cypress spec files
// import './commands'

// Example use:
// cy.get('button').click()

// Cypress.on('fail', (error, runnable) => {
//   // handle failures
// });

// Alternative way to handle uncaught exceptions
Cypress.on('uncaught:exception', (err, runnable) => {
  // returning false here prevents Cypress from failing the test
  return false;
});