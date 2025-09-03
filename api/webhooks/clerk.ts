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

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log(`Processing Clerk webhook: ${type}`, { userId: data.id })

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

      default:
        console.log(`Unhandled webhook type: ${type}`)
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('Clerk webhook error:', error)
    return res.status(400).json({ 
      error: 'Webhook verification failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function handleUserCreated(supabase: any, data: any) {
  try {
    const email = data.email_addresses?.[0]?.email_address || 'unknown@example.com'
    
    // Auto-create user in Supabase when they sign up via Clerk
    const { error } = await supabase.from('users').upsert({
      clerk_id: data.id,
      email: email,
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      plan_type: 'starter', // Default to starter plan
      credits: 25, // Starter plan gets 25 credits
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { 
      onConflict: 'clerk_id',
      ignoreDuplicates: false 
    })

    if (error) {
      console.error('Error creating user in Supabase:', error)
    } else {
      console.log(`User created: ${data.id} (${email})`)
    }
  } catch (error) {
    console.error('Error in handleUserCreated:', error)
  }
}

async function handleUserUpdated(supabase: any, data: any) {
  try {
    const email = data.email_addresses?.[0]?.email_address
    
    // Update user information
    const { error } = await supabase.from('users')
      .update({
        email: email,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        updated_at: new Date().toISOString()
      })
      .eq('clerk_id', data.id)

    if (error) {
      console.error('Error updating user in Supabase:', error)
    } else {
      console.log(`User updated: ${data.id}`)
    }
  } catch (error) {
    console.error('Error in handleUserUpdated:', error)
  }
}

async function handleUserDeleted(supabase: any, data: any) {
  try {
    // Clean up user data and related sessions
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', data.id)
      .single()

    if (userError || !userData) {
      console.log(`User not found for deletion: ${data.id}`)
      return
    }

    // Delete refresh tokens and sessions first
    await supabase.from('refresh_tokens').delete().eq('clerk_user_id', data.id)
    
    // Delete OAuth codes
    await supabase.from('oauth_codes').delete().eq('clerk_user_id', data.id)
    
    // Delete credit transactions
    await supabase.from('credit_transactions').delete().eq('user_id', userData.id)
    
    // Finally delete the user
    const { error } = await supabase.from('users').delete().eq('clerk_id', data.id)

    if (error) {
      console.error('Error deleting user from Supabase:', error)
    } else {
      console.log(`User deleted: ${data.id}`)
    }
  } catch (error) {
    console.error('Error in handleUserDeleted:', error)
  }
}