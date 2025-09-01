import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const state = searchParams.get('state')
  const authRedirect = searchParams.get('auth_redirect')
  const clientType = searchParams.get('client_type')
  
  if (!state || !authRedirect || clientType !== 'vscode_extension') {
    return NextResponse.json(
      { error: 'Invalid request parameters' },
      { status: 400 }
    )
  }

  // Store state for CSRF protection
  const stateStore = new Map()
  stateStore.set(state, {
    redirect_uri: authRedirect,
    timestamp: Date.now(),
    expires: Date.now() + 10 * 60 * 1000 // 10 minutes
  })

  // Generate Clerk sign-in URL
  const clerkSignInUrl = new URL(`${process.env.NEXT_PUBLIC_CLERK_FRONTEND_API}/v1/client/sign_in`)
  clerkSignInUrl.searchParams.set('redirect_url', `${process.env.NEXT_PUBLIC_APP_URL}/extension/callback`)
  clerkSignInUrl.searchParams.set('state', state)
  clerkSignInUrl.searchParams.set('client_type', 'vscode')

  // Redirect to sign-in page with state preservation
  return NextResponse.redirect(clerkSignInUrl.toString())
}