import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { userOperations } from '@/utils/supabase/database'
import { generateExtensionJWT } from '@/utils/jwt'
import { getAuthenticatedClient } from '@/utils/supabase/database'

export async function POST() {
  try {
    const user = await currentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clerkId = user.id
    const { data: dbUser, error: dbError } = await userOperations.getUserByClerkId(clerkId)

    if (dbError || !dbUser) {
      console.error('User not found in database for Clerk ID:', clerkId)
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 })
    }

    const supabase = await getAuthenticatedClient()

    // Revoke any existing non-expired tokens for this user
    await supabase.rpc('revoke_user_extension_tokens', {
      p_user_id: dbUser.id
    })

    // Generate new extension token
    const { token, expiresAt, hash } = generateExtensionJWT(dbUser)

    // Store the token hash in database
    const { error: insertError } = await supabase
      .from('extension_tokens')
      .insert({
        user_id: dbUser.id,
        token_hash: hash,
        name: 'VSCode Extension Token',
        expires_at: expiresAt.toISOString()
      })

    if (insertError) {
      console.error('Failed to store extension token:', insertError)
      // Still return the token, but log the issue
    }

    const expiresIn = Math.floor((expiresAt.getTime() - Date.now()) / 1000)

    return NextResponse.json({
      success: true,
      access_token: token,
      expires_in: expiresIn,
      expires_at: expiresAt.toISOString(),
      token_type: 'Bearer'
    })
  } catch (error) {
    console.error('Extension token generation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}