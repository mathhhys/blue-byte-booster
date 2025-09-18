import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { generateJWT, generateSessionId } from '../../../../../api/utils/jwt'

export async function POST(request: NextRequest) {
  try {
    // Get the current authenticated user from Clerk
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Generate our custom long-lived JWT (4 months)
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

    return NextResponse.json({
      access_token: accessToken,
      session_id: sessionId,
      expires_in: 120 * 24 * 60 * 60, // 4 months in seconds
      token_type: 'Bearer'
    })

  } catch (error) {
    console.error('Token generation error:', error)
    return NextResponse.json(
      { error: 'Token generation failed' },
      { status: 500 }
    )
  }
}