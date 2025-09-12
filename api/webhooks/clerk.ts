import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Webhook } from 'svix'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Verify webhook signature
    const webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
    
    const payload = webhook.verify(JSON.stringify(req.body), {
      'svix-id': req.headers['svix-id'] as string,
      'svix-timestamp': req.headers['svix-timestamp'] as string,
      'svix-signature': req.headers['svix-signature'] as string,
    })

    const { type, data } = payload as any
    const { id } = data;

    console.log(`Received Clerk webhook: ${type}`, { userId: id })

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log(`Processing Clerk webhook for user: ${id}`)

    try {
      switch (type) {
        case 'user.created':
          await handleUserCreated(supabase, data)
          break
        case 'user.updated':
          await handleUserUpdated(supabase, data)
          break
        case 'user.deleted':
          await handleUserDeleted(supabase, data)
          break
        case 'organization.membership.created':
            await handleOrganizationMembershipCreated(supabase, data);
            break;
        default:
          console.log(`Unhandled webhook type: ${type}`)
      }
      return res.status(200).json({ received: true })
    } catch (error) {
      console.error(`Error processing webhook ${type} for user ${id}:`, error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      return res.status(500).json({ error: `Failed to process webhook`, details: message })
    }
  } catch (error) {
    console.error('Clerk webhook signature verification failed:', error)
    return res.status(400).json({
      error: 'Webhook signature verification failed',
      details: error instanceof Error ? error.message : 'Invalid signature'
    })
  }
}

async function handleOrganizationMembershipCreated(supabase: any, data: any) {
  const { public_user_data, private_metadata } = data;
  const { user_id } = public_user_data;
  const { organization_id, role } = private_metadata;

  if (!user_id || !organization_id) {
    console.warn('Missing user_id or organization_id in organization.membership.created event. Skipping.');
    return;
  }

  // Here, you would typically update the user's record in your database
  // to associate them with the organization and assign their role.
  // For example, you might have a `memberships` table or add an `organization_id`
  // and `role` to your `users` table.

  console.log(`User ${user_id} was added to organization ${organization_id} with role ${role}`);
}

async function handleUserCreated(supabase: any, data: any) {
  const { id } = data;
  const email = data.email_addresses?.[0]?.email_address;

  if (!email) {
    console.warn(`User ${id} has no primary email address. Skipping creation.`);
    return;
  }

  const { error } = await supabase.from('users').upsert({
    clerk_id: id,
    email: email,
    first_name: data.first_name || '',
    last_name: data.last_name || '',
    avatar_url: data.image_url || null,
    plan_type: 'starter',
    credits: 25,
  }, {
    onConflict: 'clerk_id'
  });

  if (error) {
    console.error(`Error creating user ${id} in Supabase:`, error);
    throw error;
  } else {
    console.log(`User created/updated successfully: ${id} (${email})`);
  }
}

async function handleUserUpdated(supabase: any, data: any) {
  const { id } = data;
  const email = data.email_addresses?.[0]?.email_address;

  if (!email) {
    console.warn(`User ${id} has no primary email address. Skipping update.`);
    return;
  }

  const { error } = await supabase.from('users')
    .update({
      email: email,
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      avatar_url: data.image_url || null,
      updated_at: new Date().toISOString()
    })
    .eq('clerk_id', id);

  if (error) {
    console.error(`Error updating user ${id} in Supabase:`, error);
    throw error;
  } else {
    console.log(`User updated successfully: ${id}`);
  }
}

async function handleUserDeleted(supabase: any, data: any) {
  const { id } = data;

  const { error } = await supabase.from('users').delete().eq('clerk_id', id);

  if (error) {
    console.error(`Error deleting user ${id} from Supabase:`, error);
    throw error;
  } else {
    console.log(`User deleted successfully: ${id}`);
  }
}