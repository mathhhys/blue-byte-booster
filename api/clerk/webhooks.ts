import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { Webhook } from 'svix'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

    // DIAGNOSTIC LOGGING - Check payload type and content
    console.log('🔍 DIAGNOSTIC - Payload type:', typeof payload);
    console.log('🔍 DIAGNOSTIC - Payload is Buffer:', Buffer.isBuffer(payload));
    console.log('🔍 DIAGNOSTIC - Payload length:', payload?.length || 'undefined');
    console.log('🔍 DIAGNOSTIC - First 100 chars of payload:',
      typeof payload === 'string' ? payload.substring(0, 100) :
      Buffer.isBuffer(payload) ? payload.toString().substring(0, 100) :
      JSON.stringify(payload).substring(0, 100)
    );
    
    // DIAGNOSTIC LOGGING - Check webhook secret format
    console.log('🔍 DIAGNOSTIC - Webhook secret format check:');
    console.log('  - Has whsec_ prefix:', CLERK_WEBHOOK_SIGNING_SECRET?.startsWith('whsec_'));
    console.log('  - Secret length:', CLERK_WEBHOOK_SIGNING_SECRET?.length);
    console.log('  - First 10 chars:', CLERK_WEBHOOK_SIGNING_SECRET?.substring(0, 10));

    const svix_id = headers['svix-id'];
    const svix_timestamp = headers['svix-timestamp'];
    const svix_signature = headers['svix-signature'];

    // DIAGNOSTIC LOGGING - Check headers in detail
    console.log('🔍 DIAGNOSTIC - Svix headers:');
    console.log('  - svix-id:', svix_id);
    console.log('  - svix-timestamp:', svix_timestamp);
    console.log('  - svix-signature:', svix_signature);
    console.log('  - Current timestamp:', Math.floor(Date.now() / 1000));
    console.log('  - Timestamp diff:', Math.floor(Date.now() / 1000) - parseInt(svix_timestamp as string || '0'));

    // If there are no Svix headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.log('❌ No Svix headers found:', { svix_id: !!svix_id, svix_timestamp: !!svix_timestamp, svix_signature: !!svix_signature })
      return res.status(400).json({ error: 'No Svix headers found.' });
    }

    // Create a new Webhook instance with your Clerk webhook secret
    const wh = new Webhook(CLERK_WEBHOOK_SIGNING_SECRET);

    let evt;
    try {
      // DIAGNOSTIC LOGGING - Before verification attempt
      console.log('🔍 DIAGNOSTIC - Attempting verification with:');
      console.log('  - Payload type for verification:', typeof payload);
      console.log('  - Headers for verification:', {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature
      });

      // Try with different payload formats to diagnose the issue
      let verificationPayload = payload;
      
      // If payload is already parsed as JSON, convert back to string
      if (typeof payload === 'object' && !Buffer.isBuffer(payload)) {
        console.log('🔍 DIAGNOSTIC - Converting parsed JSON back to string for verification');
        verificationPayload = JSON.stringify(payload);
      }

      // Verify the webhook payload
      evt = wh.verify(verificationPayload, {
        'svix-id': svix_id as string,
        'svix-timestamp': svix_timestamp as string,
        'svix-signature': svix_signature as string,
      });
      
      console.log('✅ DIAGNOSTIC - Webhook verification successful!');
    } catch (err) {
      console.error('❌ DIAGNOSTIC - Webhook verification failed with error:', err);
      console.error('❌ DIAGNOSTIC - Error details:', {
        name: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : 'No stack trace'
      });
      
      // Try alternative verification method if first attempt fails
      if (typeof payload === 'object' && !Buffer.isBuffer(payload)) {
        console.log('🔄 DIAGNOSTIC - Trying verification with original JSON object...');
        try {
          evt = wh.verify(JSON.stringify(payload), {
            'svix-id': svix_id as string,
            'svix-timestamp': svix_timestamp as string,
            'svix-signature': svix_signature as string,
          });
          console.log('✅ DIAGNOSTIC - Alternative verification successful!');
        } catch (secondErr) {
          console.error('❌ DIAGNOSTIC - Alternative verification also failed:', secondErr);
        }
      }
      
      if (!evt) {
        return res.status(400).json({
          error: 'Webhook verification failed.',
          diagnostics: {
            payloadType: typeof payload,
            isBuffer: Buffer.isBuffer(payload),
            hasWhsecPrefix: CLERK_WEBHOOK_SIGNING_SECRET?.startsWith('whsec_'),
            timestampDiff: Math.floor(Date.now() / 1000) - parseInt(svix_timestamp as string || '0'),
            errorMessage: err instanceof Error ? err.message : String(err)
          }
        });
      }
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

      } else if (eventType === 'user.deleted' || eventType === 'user.banned') {
        const user = evt.data;
        if (!user.id) {
          console.error('User ID not found in user.deleted webhook payload');
          return res.status(400).json({ error: 'User ID not found in payload.' });
        }

        // Revoke all active VSCode sessions for this user
        const { error: sessionError } = await supabase
          .from('vscode_sessions')
          .update({ is_active: false })
          .eq('user_id', user.id);

        if (sessionError) {
          console.error('Error revoking VSCode sessions:', sessionError);
        } else {
          console.log(`Revoked all VSCode sessions for user ${user.id} due to ${eventType}`);
        }

        // Soft-delete or mark user as inactive in database
        const { error: userError } = await supabase
          .from('users')
          .update({
            is_active: false,
            deleted_at: new Date().toISOString()
          })
          .eq('clerk_id', user.id);

        if (userError) {
          console.error('Error marking user as inactive:', userError);
        } else {
          console.log(`Marked user ${user.id} as inactive due to ${eventType}`);
        }

      } else if (eventType === 'session.ended' || eventType === 'session.revoked') {
        const session = evt.data;
        if (!session.user_id) {
          console.log('No user_id in session event, skipping revocation');
          return res.json({ received: true });
        }

        // Revoke VSCode sessions associated with this Clerk session
        const { error: sessionError } = await supabase
          .from('vscode_sessions')
          .update({ is_active: false })
          .eq('clerk_session_id', session.id);  // Assuming we store Clerk session ID

        if (sessionError && sessionError.code !== 'PGRST116') {  // PGRST116 = no rows updated
          console.error('Error revoking VSCode sessions for session event:', sessionError);
        } else {
          console.log(`Revoked VSCode sessions for Clerk session ${session.id} due to ${eventType}`);
        }

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