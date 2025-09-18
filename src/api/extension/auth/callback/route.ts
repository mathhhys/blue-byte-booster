import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, grant_type, redirect_uri } = body

    if (grant_type !== 'authorization_code') {
      return NextResponse.json(
        { error: 'Unsupported grant type' },
        { status: 400 }
      )
    }

    // Get the actual client instance - clerkClient is a function in v6+
    const client = typeof clerkClient === 'function' ? await clerkClient() : clerkClient

    // Exchange authorization code for session
    const session = await client.sessions.createSession({
      userId: code // In real implementation, exchange code for userId
    })

    // Get user information
    const user = await client.users.getUser(session.userId)
    
    // Sync with Supabase
    await syncUserWithSupabase(user)

    // Generate unified long-lived JWT token instead of sessionId
    const { generateJWT, generateSessionId } = require('../../../../api/utils/jwt')
    const sessionId = generateSessionId()
    const accessToken = generateJWT(
      {
        clerk_id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        organization_id: null,
        plan_type: 'default'
      },
      sessionId
    )

    // ensure the exp is exactly 4 months (~120 days) after generation
    const decoded = require('jsonwebtoken').decode(accessToken)
    const fourMonths = 120 * 24 * 60 * 60 // seconds
    const updatedPayload = { ...decoded, exp: Math.floor(Date.now() / 1000) + fourMonths }
    const jwt = require('jsonwebtoken')
    const finalAccessToken = jwt.sign(updatedPayload, process.env.JWT_SECRET!)

    return NextResponse.json({
      access_token: accessToken,
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
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    )
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