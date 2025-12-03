// Stripe webhook handler for Kinde organization subscriptions
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_KINDE_WEBHOOK_SECRET;

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  console.log('=== STRIPE KINDE WEBHOOK ENTRY ===');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase configuration missing');
    return res.status(500).json({ error: 'Database configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        // Check if this is a Kinde organization subscription
        if (session.metadata?.provider === 'kinde' && session.metadata?.kinde_org_code) {
          const orgCode = session.metadata.kinde_org_code;
          
          console.log(`Processing Kinde org subscription for: ${orgCode}`);

          if (session.metadata.type === 'org_subscription') {
            // Get subscription details from Stripe
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            const subscriptionItem = subscription.items.data[0];
            
            // Create subscription record
            const { error: subError } = await supabase
              .from('kinde_organization_subscriptions')
              .upsert({
                kinde_org_code: orgCode,
                stripe_subscription_id: session.subscription,
                stripe_customer_id: session.customer,
                plan_type: 'teams',
                status: 'active',
                seats_total: parseInt(subscription.metadata?.seats_total || subscriptionItem?.quantity || 3),
                billing_frequency: subscription.metadata?.billing_frequency || 'monthly',
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }, {
                onConflict: 'kinde_org_code,stripe_subscription_id',
              });

            if (subError) {
              console.error('Error creating subscription:', subError);
            }

            // Assign the first seat to the creator
            if (subscription.metadata?.kinde_user_id) {
              await supabase
                .from('kinde_organization_seats')
                .insert({
                  kinde_org_code: orgCode,
                  user_id: subscription.metadata.kinde_user_id,
                  email: session.customer_email || 'admin@org',
                  role: 'admin',
                  status: 'active',
                  assigned_at: new Date().toISOString(),
                  assigned_by: subscription.metadata.kinde_user_id,
                });
            }
          } else if (session.metadata.type === 'additional_seats') {
            // Handle additional seats purchase
            const additionalSeats = parseInt(session.metadata.quantity || 1);
            
            const { data: currentSub } = await supabase
              .from('kinde_organization_subscriptions')
              .select('seats_total')
              .eq('kinde_org_code', orgCode)
              .eq('status', 'active')
              .single();

            if (currentSub) {
              await supabase
                .from('kinde_organization_subscriptions')
                .update({
                  seats_total: currentSub.seats_total + additionalSeats,
                  updated_at: new Date().toISOString(),
                })
                .eq('kinde_org_code', orgCode)
                .eq('status', 'active');
            }
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        
        // Check if this is a Kinde subscription
        if (subscription.metadata?.kinde_org_code) {
          const orgCode = subscription.metadata.kinde_org_code;
          
          await supabase
            .from('kinde_organization_subscriptions')
            .update({
              status: subscription.status === 'active' ? 'active' : subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subscription.id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        if (subscription.metadata?.kinde_org_code) {
          // Mark subscription as canceled
          await supabase
            .from('kinde_organization_subscriptions')
            .update({
              status: 'canceled',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', subscription.id);

          // Optionally revoke all seats
          await supabase
            .from('kinde_organization_seats')
            .update({
              status: 'revoked',
            })
            .eq('kinde_org_code', subscription.metadata.kinde_org_code);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        
        // Get subscription to check if it's a Kinde org
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          
          if (subscription.metadata?.kinde_org_code) {
            // Mark subscription as past_due
            await supabase
              .from('kinde_organization_subscriptions')
              .update({
                status: 'past_due',
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_subscription_id', invoice.subscription);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}