import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

// This would typically integrate with your user database
// For now, we'll create a simple implementation that creates customers on demand
export const getOrCreateStripeCustomer = async (clerkUserId: string): Promise<string> => {
  try {
    // In a real implementation, you would:
    // 1. Check your database for an existing Stripe customer ID for this user
    // 2. If found, return it
    // 3. If not found, create a new Stripe customer and store the ID in your database

    // For now, we'll search for existing customers by metadata
    const existingCustomers = await stripe.customers.list({
      limit: 1,
      expand: ['data'],
    });

    // Look for a customer with matching clerk user ID in metadata
    const existingCustomer = existingCustomers.data.find(
      customer => customer.metadata?.clerkUserId === clerkUserId
    );

    if (existingCustomer) {
      console.log('Found existing Stripe customer:', existingCustomer.id);
      return existingCustomer.id;
    }

    // Create a new customer
    console.log('Creating new Stripe customer for user:', clerkUserId);
    const customer = await stripe.customers.create({
      metadata: {
        clerkUserId: clerkUserId,
      },
      // You might want to add email and name here if available from Clerk
    });

    console.log('Created new Stripe customer:', customer.id);
    return customer.id;
  } catch (error) {
    console.error('Error getting or creating Stripe customer:', error);
    throw new Error(`Failed to get or create Stripe customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};