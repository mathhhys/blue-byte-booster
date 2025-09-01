import { useAuth } from '@clerk/nextjs'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function ExtensionCallback() {
  const { isSignedIn, userId } = useAuth()
  const router = useRouter()
  const { state } = router.query

  useEffect(() => {
    if (isSignedIn && userId && state) {
      // Generate authorization code for VSCode
      generateAuthCode(userId, state as string)
    }
  }, [isSignedIn, userId, state])

  const generateAuthCode = async (userId: string, state: string) => {
    try {
      const response = await fetch('/api/extension/auth/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, state })
      })

      const { code } = await response.json()
      
      // Redirect back to VSCode with authorization code
      const vscodeUrl = `vscode://kilocode.kilo-code?code=${code}&state=${state}`
      window.location.href = vscodeUrl
      
    } catch (error) {
      console.error('Failed to generate auth code:', error)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Authenticating VSCode Extension</h1>
        <p className="text-gray-600">Please wait while we complete the authentication...</p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mt-4"></div>
      </div>
    </div>
  )
}