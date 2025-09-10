import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil', // Updated API version
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getOrCreateStripeCustomer(clerkUserId: string): Promise<string> {
  // Check if the user already has a Stripe customer ID in your database
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('clerk_id', clerkUserId)
    .single();

  if (userError) {
    console.error('Error fetching user from Supabase:', userError);
    throw new Error('Failed to fetch user data');
  }

  if (userData?.stripe_customer_id) {
    return userData.stripe_customer_id;
  }

  // If not, create a new Stripe customer
  const customer = await stripe.customers.create({
    metadata: {
      clerkUserId: clerkUserId,
    },
  });

  // Store the new Stripe customer ID in your database
  const { error: updateError } = await supabase
    .from('users')
    .update({ stripe_customer_id: customer.id })
    .eq('clerk_id', clerkUserId);

  if (updateError) {
    console.error('Error updating user in Supabase:', updateError);
    throw new Error('Failed to update user data with Stripe customer ID');
  }

  return customer.id;
}