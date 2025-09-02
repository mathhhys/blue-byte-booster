import { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { state, auth_redirect, client_type } = req.query
  
  if (!state || !auth_redirect || client_type !== 'vscode_extension') {
    return res.status(400).json({ error: 'Invalid request parameters' })
  }

  // Store state for CSRF protection (in production, use Redis or database)
  const stateStore = new Map()
  stateStore.set(state, {
    redirect_uri: auth_redirect,
    timestamp: Date.now(),
    expires: Date.now() + 10 * 60 * 1000 // 10 minutes
  })

  // Generate Clerk sign-in URL
  const clerkSignInUrl = new URL(`${process.env.NEXT_PUBLIC_CLERK_FRONTEND_API}/v1/client/sign_in`)
  clerkSignInUrl.searchParams.set('redirect_url', `${process.env.NEXT_PUBLIC_APP_URL}/extension/callback`)
  clerkSignInUrl.searchParams.set('state', state as string)
  clerkSignInUrl.searchParams.set('client_type', 'vscode')

  // Redirect to sign-in page with state preservation
  res.redirect(clerkSignInUrl.toString())
}