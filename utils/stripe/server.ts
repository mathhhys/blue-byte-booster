import Stripe from 'stripe';
import { MULTI_CURRENCY_PRICING } from '../../src/config/pricing.js';

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

// Create organization subscription with quantity and currency support
export const createOrganizationSubscription = async (
  customerId: string,
  planType: 'pro' | 'teams',
  billingFrequency: 'monthly' | 'yearly',
  quantity: number,
  currency: string = 'USD',
  metadata: Record<string, string> = {}
): Promise<Stripe.Subscription> => {
  try {
    // Get the price ID based on plan type, billing frequency, and currency
    const pricing = MULTI_CURRENCY_PRICING[planType][currency as keyof typeof MULTI_CURRENCY_PRICING.pro];
    if (!pricing) {
      throw new Error(`Unsupported currency: ${currency} for plan type: ${planType}`);
    }

    const priceId = pricing.priceIds[billingFrequency];
    if (!priceId) {
      throw new Error(`Price ID not found for ${billingFrequency} billing`);
    }

    console.log('Creating organization subscription:', {
      customerId,
      planType,
      billingFrequency,
      quantity,
      currency,
      priceId
    });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price: priceId,
        quantity: quantity,
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        ...metadata,
        plan_type: planType,
        billing_frequency: billingFrequency,
        currency: currency,
        seats: quantity.toString()
      }
    });

    console.log('Organization subscription created:', subscription.id);
    return subscription;
  } catch (error) {
    console.error('Error creating organization subscription:', error);
    throw new Error(`Failed to create organization subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Update subscription quantity
export const updateSubscriptionQuantity = async (
  subscriptionId: string,
  quantity: number,
  prorate: boolean = true
): Promise<Stripe.Subscription> => {
  try {
    console.log('Updating subscription quantity:', { subscriptionId, quantity, prorate });

    // First, get the current subscription to find the current item ID
    const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    const itemId = currentSubscription.items.data[0]?.id;

    if (!itemId) {
      throw new Error('No subscription items found');
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: itemId,
        quantity: quantity,
      }],
      proration_behavior: prorate ? 'create_prorations' : 'none',
      metadata: {
        ...currentSubscription.metadata,
        seats: quantity.toString()
      }
    });

    console.log('Subscription quantity updated:', subscription.id);
    return subscription;
  } catch (error) {
    console.error('Error updating subscription quantity:', error);
    throw new Error(`Failed to update subscription quantity: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Get subscription by ID
export const getSubscription = async (subscriptionId: string): Promise<Stripe.Subscription> => {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error('Error retrieving subscription:', error);
    throw new Error(`Failed to retrieve subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Cancel subscription
export const cancelSubscription = async (subscriptionId: string): Promise<Stripe.Subscription> => {
  try {
    return await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw new Error(`Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};