import { VercelRequest, VercelResponse } from '@vercel/node'
import { clerkClient } from '@clerk/clerk-sdk-node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { code, grant_type, redirect_uri } = req.body

    if (grant_type !== 'authorization_code') {
      return res.status(400).json({ error: 'Unsupported grant type' })
    }

    // Get the actual client instance
    const client = clerkClient

    // In a real implementation, you would exchange the authorization code
    // for a valid session. For now, we'll simulate this process.
    // The code parameter should contain a valid user ID after proper OAuth flow
    
    // Get user information directly (assuming code contains userId for demo)
    const user = await client.users.getUser(code)
    
    // Create a session token (in production, use proper session management)
    const sessionId = `session_${Date.now()}_${user.id}`
    
    // Sync with Supabase
    await syncUserWithSupabase(user)

    // Return VSCode-compatible response
    return res.status(200).json({
      access_token: sessionId, // Use session ID as token for now
      session_id: sessionId,
      organization_id: null, // Organization handling to be implemented separately
      user: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        name: `${user.firstName} ${user.lastName}`.trim(),
        picture: user.imageUrl
      }
    })

  } catch (error) {
    console.error('VSCode auth callback error:', error)
    return res.status(500).json({ error: 'Authentication failed' })
  }
}

async function syncUserWithSupabase(clerkUser: any) {
  const { createClient } = require('@supabase/supabase-js')
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const userData = {
    clerk_id: clerkUser.id,
    email: clerkUser.emailAddresses[0]?.emailAddress,
    name: `${clerkUser.firstName} ${clerkUser.lastName}`.trim(),
    avatar_url: clerkUser.imageUrl,
    updated_at: new Date().toISOString()
  }

  const { error } = await supabase
    .from('users')
    .upsert(userData, { onConflict: 'clerk_id' })

  if (error) {
    console.error('Supabase sync error:', error)
  }
}