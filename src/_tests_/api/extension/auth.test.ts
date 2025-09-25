import { describe, test, expect, vi } from 'vitest'
import { POST } from '../../../api/extension/auth/callback/route'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: {
    sessions: {
      createSessionToken: vi.fn()
    },
    users: {
      getUser: vi.fn()
    }
  }
}))

describe('VSCode Auth Callback API', () => {
  test('should handle valid authorization code', async () => {
    const mockRequest = new NextRequest('http://localhost:3000/api/extension/auth/callback', {
      method: 'POST',
      body: JSON.stringify({
        code: 'valid_auth_code_123',
        grant_type: 'authorization_code',
        redirect_uri: 'vscode://softcodes.softcodes'
      })
    })

    // Add logging to validate clerkClient structure
    const { clerkClient } = await import('@clerk/nextjs/server')
    console.log('clerkClient type:', typeof clerkClient)
    console.log('clerkClient is function:', typeof clerkClient === 'function')
    
    // Mock clerkClient properly - it's a function in v6+ that returns a Promise<ClerkClient>
    const mockClerkClient = {
      sessions: {
        createSession: vi.fn().mockResolvedValue({
          id: 'session_123',
          userId: 'user_123'
        })
      },
      users: {
        getUser: vi.fn().mockResolvedValue({
          id: 'user_123',
          firstName: 'Test',
          lastName: 'User',
          emailAddresses: [{ emailAddress: 'test@example.com' }],
          imageUrl: 'https://example.com/avatar.jpg'
        })
      },
      telemetry: {
        // Add telemetry property to satisfy ClerkClient interface
        record: vi.fn()
      }
    }
    
    // Mock clerkClient as a function that returns the mock client
    vi.mocked(clerkClient as any).mockResolvedValue(mockClerkClient)

    const response = await POST(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('access_token')
    expect(data).toHaveProperty('session_id')
    expect(data).toHaveProperty('user')
    expect(data.user).toHaveProperty('id', 'user_123')
    expect(data.user).toHaveProperty('email', 'test@example.com')
    expect(data.user).toHaveProperty('name', 'Test User')
    expect(data.user).toHaveProperty('picture', 'https://example.com/avatar.jpg')
    expect(data.access_token).toBe('session_123')
    expect(data.session_id).toBe('session_123')
  })
})