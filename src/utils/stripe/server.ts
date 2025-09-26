
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
 // Assume getPriceId from config/pricing.ts; use literal if not exported
const getPriceId = (plan: string, frequency: string) => {
  const prices = {
    'teams_monthly': 'price_1RwNazH6gWxKcaTXi3OmXp4u', // Existing
    'teams_yearly': 'price_teams_yearly',
    'overage_api': 'price_overage_api', // Added if missing
  };
  return prices[`${plan}_${frequency}` as keyof typeof prices] || prices['teams_monthly'];
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-08-27.basil' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function getOrCreateStripeCustomer(clerkUserId: string): Promise<string> {
  // Existing logic
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

  const customer = await stripe.customers.create({
    metadata: {
      clerkUserId: clerkUserId,
    },
  });

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

// Enhanced webhook handler for seat changes, prorating, overages
export async function handleStripeWebhook(req: Request) {
  const body = await req.text();
  const h = await headers();
  const sig = h.get('stripe-signature')!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return new Response(`Webhook signature verification failed.`, { status: 400 });
  }

  switch (event.type) {
    case 'invoice.payment_succeeded':
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.billing_reason === 'subscription_update') {
        const sub = await stripe.subscriptions.retrieve((invoice as any).subscription as string);
        const metadata = sub.metadata;
        const orgId = metadata.clerk_org_id;
        const seats = (sub.items.data[0]?.quantity || 1);

        // Update DB seats_total
        const { error } = await supabase
          .from('organization_subscriptions')
          .update({ seats_total: seats, current_period_end: new Date((sub as any).current_period_end * 1000) })
          .eq('clerk_org_id', orgId);

        if (error) console.error('Failed to update seats:', error);
      }
      break;

    case 'customer.subscription.updated':
      const subUpdate = event.data.object as Stripe.Subscription;
      const previousQuantity = (event.data.previous_attributes as any)?.quantity;
      if (previousQuantity !== undefined && subUpdate.items.data[0].quantity !== previousQuantity) {
        const orgId = subUpdate.metadata.clerk_org_id;
        const newQuantity = subUpdate.items.data[0].quantity;
        // Prorate upgrade/downgrade
        if (newQuantity > previousQuantity) {
          const invoice = await stripe.invoices.create({
            customer: subUpdate.customer as string,
            auto_advance: true,
          });
          await stripe.invoices.finalizeInvoice(invoice.id);
        }
        // Update DB
        await supabase.from('organization_subscriptions').update({ seats_total: newQuantity }).eq('clerk_org_id', orgId);
      }
      break;

    case 'invoice.created':
      const newInvoice = event.data.object as Stripe.Invoice;
      if (newInvoice.metadata.overage) {
        const orgId = newInvoice.metadata.clerk_org_id;
        const { data: org } = await supabase.from('organizations').select('id').eq('clerk_org_id', orgId).single();
        const { data: usages } = await supabase
          .from('license_usages')
          .select('usage_count, feature')
          .eq('organization_id', org?.id)
          .eq('overage', true);

        usages?.forEach(async (usage) => {
          await stripe.invoiceItems.create({
            customer: newInvoice.customer as string,
            invoice: newInvoice.id,
            quantity: usage.usage_count,
            price_data: {
              currency: 'usd',
              unit_amount: 500, // $5 per unit, adjust
              product_data: {
                name: `Overage for ${usage.feature}`,
              },
            } as any,
            description: `Overage for ${usage.feature}`,
          });
        });
      }
      break;

    // Payment failure rollback (edge case)
    case 'invoice.payment_failed':
      const failedInvoice = event.data.object as Stripe.Invoice;
      const subId = (failedInvoice as any).subscription as string;
      const orgId = failedInvoice.metadata.clerk_org_id;
      // Rollback seats if upgrade failed (fetch previous quantity from DB or event)
      await supabase.from('organization_subscriptions').update({ seats_total: 1 }).eq('stripe_subscription_id', subId); // Default rollback to 1 or previous
      console.log('Rolled back subscription due to payment failure');
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response('OK', { status: 200 });
}

// Modified createOrganizationSubscription to set quantity=seats (existing pricing IDs)
export async function createOrganizationSubscription(params: { clerk_org_id: string; plan_type: string; billing_frequency: string; seats_total: number }) {
  const { clerk_org_id, plan_type, billing_frequency, seats_total } = params;
  const priceId = getPriceId(plan_type, billing_frequency); // e.g., 'price_teams_monthly'

  const customer = await stripe.customers.create({
    metadata: { clerk_org_id },
  });

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId, quantity: seats_total }], // Dynamic seats
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    metadata: { clerk_org_id, seats_total: seats_total.toString() },
  });

  // Update DB
  await supabase.rpc('upsert_organization', { p_clerk_org_id: clerk_org_id, p_stripe_customer_id: customer.id });
  const { data: org } = await supabase.from('organizations').select('id').eq('clerk_org_id', clerk_org_id).single();
  await supabase.from('organization_subscriptions').insert({
    organization_id: org?.id,
    clerk_org_id,
    stripe_customer_id: customer.id,
    stripe_subscription_id: subscription.id,
    plan_type,
    billing_frequency,
    seats_total,
    status: subscription.status,
    current_period_start: new Date((subscription as any).current_period_start * 1000),
    current_period_end: new Date((subscription as any).current_period_end * 1000),
  });

  return subscription;
}