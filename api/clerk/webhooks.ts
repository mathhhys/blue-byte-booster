import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Webhook } from 'svix'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add debugging logs to validate deployment
  console.log('🚀 Clerk webhook handler called at /api/clerk/webhooks - URL:', req.url)
  console.log('🚀 Request method:', req.method)
  console.log('🚀 Headers:', JSON.stringify(req.headers, null, 2))
  console.log('🚀 Environment check - CLERK_WEBHOOK_SIGNING_SECRET exists:', !!process.env.CLERK_WEBHOOK_SIGNING_SECRET)
  console.log('🚀 Environment check - VITE_SUPABASE_URL exists:', !!process.env.VITE_SUPABASE_URL)
  console.log('🚀 Environment check - SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const CLERK_WEBHOOK_SIGNING_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  if (!CLERK_WEBHOOK_SIGNING_SECRET) {
    console.error('CLERK_WEBHOOK_SIGNING_SECRET is not set in environment variables.');
    return res.status(500).json({ error: 'Webhook secret not configured.' });
  }

  try {
    const payload = req.body;
    const headers = req.headers;

    const svix_id = headers['svix-id'];
    const svix_timestamp = headers['svix-timestamp'];
    const svix_signature = headers['svix-signature'];

    // If there are no Svix headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.log('❌ No Svix headers found:', { svix_id: !!svix_id, svix_timestamp: !!svix_timestamp, svix_signature: !!svix_signature })
      return res.status(400).json({ error: 'No Svix headers found.' });
    }

    // Create a new Webhook instance with your Clerk webhook secret
    const wh = new Webhook(CLERK_WEBHOOK_SIGNING_SECRET);

    let evt;
    try {
      // Verify the webhook payload
      evt = wh.verify(payload, {
        'svix-id': svix_id as string,
        'svix-timestamp': svix_timestamp as string,
        'svix-signature': svix_signature as string,
      });
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return res.status(400).json({ error: 'Webhook verification failed.' });
    }

    const eventType = evt.type;
    console.log(`Received Clerk webhook with ID ${evt.data.id} and event type of ${eventType}`);
    console.log('Webhook payload:', evt.data);

    // Initialize Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      if (eventType === 'user.created' || eventType === 'user.updated') {
        const user = evt.data;
        
        // Handle email addresses with graceful fallbacks
        let primaryEmailAddress: string | null = null;
        
        // Try to find primary email by ID first
        if (user.email_addresses && user.email_addresses.length > 0) {
          primaryEmailAddress = user.email_addresses.find(
            (email: any) => email.id === user.primary_email_address_id
          )?.email_address || user.email_addresses[0]?.email_address;
        }
        
        // If no email found but user has primary_email_address_id, use a placeholder
        if (!primaryEmailAddress) {
          if (user.primary_email_address_id) {
            // Use a placeholder email format for users without accessible email data
            primaryEmailAddress = `user_${user.id.replace('user_', '')}@clerk.placeholder`;
            console.warn(`No email addresses available for user ${user.id}, using placeholder: ${primaryEmailAddress}`);
          } else {
            // Fallback to a generic placeholder
            primaryEmailAddress = `${user.id}@clerk.placeholder`;
            console.warn(`No email data found for user ${user.id}, using generic placeholder: ${primaryEmailAddress}`);
          }
        }

        const { data, error } = await supabase.rpc('upsert_user', {
          p_clerk_id: user.id,
          p_email: primaryEmailAddress,
          p_first_name: user.first_name || null,
          p_last_name: user.last_name || null,
          p_avatar_url: user.image_url || user.profile_image_url || null,
          p_plan_type: 'starter' // Default to starter, update later if needed
        });

        if (error) {
          console.error('Error upserting user from webhook:', error);
          return res.status(500).json({ error: 'Failed to upsert user.' });
        }
        console.log(`Successfully upserted user ${user.id} from webhook with email: ${primaryEmailAddress}`);

      } else if (eventType === 'user.deleted') {
        const user = evt.data;
        if (!user.id) {
          console.error('User ID not found in user.deleted webhook payload');
          return res.status(400).json({ error: 'User ID not found in payload.' });
        }

        // In a real application, you might want to soft-delete the user
        // or remove sensitive information. For this example, we'll log.
        console.log(`User with Clerk ID ${user.id} marked for deletion.`);
        // Example: await supabase.from('users').update({ deleted: true }).eq('clerk_id', user.id);
        // Or delete: await supabase.from('users').delete().eq('clerk_id', user.id);

      } else {
        console.log(`Unhandled Clerk webhook event type: ${eventType}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing Clerk webhook event:', error);
      res.status(500).json({ error: 'Webhook event processing failed.' });
    }
  } catch (error) {
    console.error('Clerk webhook signature verification failed:', error);
    return res.status(400).json({
      error: 'Webhook signature verification failed',
      details: error instanceof Error ? error.message : 'Invalid signature'
    });
  }
}