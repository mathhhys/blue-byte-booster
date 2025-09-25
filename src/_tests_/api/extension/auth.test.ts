import { describe, test, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Mock modules at top level
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn()
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}))
vi.mock('jsonwebtoken', () => ({
  sign: vi.fn(),
  verify: vi.fn(),
  decode: vi.fn()
}))
vi.mock('crypto', () => ({
  createHash: vi.fn()
}))
vi.mock('@clerk/nextjs/server', () => ({
  clerkClient: vi.fn()
}))

// Type assertions for mocks
declare const mockSupabase: any
declare const verifyToken: any
declare const jwt: any
declare const crypto: any

const mockClaims = {
  sub: 'user_123',
  email: 'test@example.com',
  org_id: 'org_123',
  org_role: 'org:admin',
  iss: 'https://clerk.softcodes.ai',
  iat: Math.floor(Date.now() / 1000),
  nbf: Math.floor(Date.now() / 1000),
  sid: 'sess_123'
} as any

const mockUserData = {
  id: 'user_uuid_123',
  clerk_id: 'user_123',
  email: 'test@example.com',
  plan_type: 'pro',
  credits: 100
}

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
    record: vi.fn()
  }
} as any

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

    const { clerkClient } = await import('@clerk/nextjs/server')
    vi.mocked(clerkClient).mockResolvedValue(mockClerkClient)

    const { POST } = await import('../../../api/extension/auth/callback/route')
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

describe('Extension Token API', () => {
  const mockReq = {
    method: 'POST',
    headers: {
      authorization: 'Bearer mock_clerk_token'
    }
  } as any

  const mockRes = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn()
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jwt.sign).mockImplementation(() => 'mock_custom_token')
    vi.mocked(jwt.verify).mockImplementation(() => mockClaims)
    vi.mocked(jwt.decode).mockImplementation(() => ({
      ...mockClaims,
      ...mockUserData,
      scope: 'vscode:auth',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 12096000,
      iss: 'softcodes.ai',
      aud: 'vscode-extension'
    }))
    vi.mocked(createClient).mockImplementation(() => mockSupabase)
    vi.mocked(mockSupabase.from().select().eq().single).mockImplementation(() => Promise.resolve({ data: mockUserData, error: null }))
    vi.mocked(mockSupabase.from().insert).mockImplementation(() => Promise.resolve({ error: null }))
    vi.mocked(verifyToken).mockImplementation(() => Promise.resolve(mockClaims))
    mockRes.status.mockReturnValue(mockRes)
    mockRes.json.mockReturnValue(mockRes)
  })

  test('should generate custom extension token successfully', async () => {
    const { default: handler } = await import('../../../../api/extension/auth/token.ts')
    await handler(mockReq, mockRes)

    expect(verifyToken).toHaveBeenCalledWith('mock_clerk_token', expect.any(Object))
    expect(mockSupabase.from).toHaveBeenCalledWith('users')
    expect(mockSupabase.from().select).toHaveBeenCalledWith('id, clerk_id, email, plan_type, credits')
    expect(mockSupabase.from().select().eq).toHaveBeenCalledWith('clerk_id', 'user_123')
    expect(mockSupabase.from().select().eq().single).toHaveBeenCalled()
    expect(jwt.sign).toHaveBeenCalled()
    expect(crypto.createHash).toHaveBeenCalledWith('sha256')
    expect(mockSupabase.from().insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user_uuid_123',
      token_hash: 'mock_token_hash',
      expires_at: expect.any(Date)
    }))
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      access_token: 'mock_custom_token',
      expires_in: 12096000,
      token_type: 'Bearer'
    }))
  })

  test('should return 404 if user not found', async () => {
    vi.mocked(mockSupabase.from().select().eq().single).mockImplementation(() => Promise.resolve({ data: null, error: null }))

    const { default: handler } = await import('../../../../api/extension/auth/token.ts')
    await handler(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(404)
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not found in database' })
  })

  test('should return 500 if token storage fails', async () => {
    vi.mocked(mockSupabase.from().insert).mockImplementation(() => Promise.resolve({ error: { message: 'DB error' } }))

    const { default: handler } = await import('../../../../api/extension/auth/token.ts')
    await handler(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to generate token' })
  })

  test('should return 500 if Clerk token verification fails', async () => {
    vi.mocked(verifyToken).mockImplementation(() => Promise.reject(new Error('Invalid token')))

    const { default: handler } = await import('../../../../api/extension/auth/token.ts')
    await handler(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Internal server error' }))
  })

  test('should return 405 for non-POST method', async () => {
    mockReq.method = 'GET'

    const { default: handler } = await import('../../../../api/extension/auth/token.ts')
    await handler(mockReq, mockRes)

    expect(mockRes.status).toHaveBeenCalledWith(405)
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Method not allowed' })
  })
})

describe('Extension Token Revoke API', () => {
  const mockReqRevoke = {
    method: 'POST',
    headers: {
      authorization: 'Bearer mock_custom_token'
    }
  } as any

  const mockResRevoke = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn()
  } as any

  const mockUserDataRevoke = {
    id: 'user_uuid_123'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(jwt.verify).mockImplementation(() => ({
      sub: 'user_123',
      scope: 'vscode:auth'
    }))
    vi.mocked(createClient).mockImplementation(() => mockSupabase)
    vi.mocked(mockSupabase.from().select().eq().single).mockImplementation(() => Promise.resolve({ data: mockUserDataRevoke, error: null }))
    vi.mocked(mockSupabase.from().update).mockImplementation(() => Promise.resolve({ error: null }))
    vi.mocked(crypto.createHash).mockImplementation(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('mock_token_hash')
    }))
    mockResRevoke.status.mockReturnValue(mockResRevoke)
    mockResRevoke.json.mockReturnValue(mockResRevoke)
  })

  test('should revoke token successfully', async () => {
    const { default: revokeHandler } = await import('../../../../api/extension/auth/revoke.ts')
    await revokeHandler(mockReqRevoke, mockResRevoke)

    expect(jwt.verify).toHaveBeenCalledWith('mock_custom_token', process.env.JWT_SECRET)
    expect(mockSupabase.from).toHaveBeenCalledWith('users')
    expect(mockSupabase.from().select).toHaveBeenCalledWith('id')
    expect(mockSupabase.from().select().eq).toHaveBeenCalledWith('clerk_id', 'user_123')
    expect(mockSupabase.from().update).toHaveBeenCalledWith({ revoked_at: expect.any(Date) })
    expect(mockSupabase.from().update().eq).toHaveBeenCalledWith('token_hash', 'mock_token_hash')
    expect(mockSupabase.from().update().eq).toHaveBeenCalledWith('user_id', 'user_uuid_123')
    expect(mockSupabase.from().update().eq).toHaveBeenCalledWith('revoked_at', null)
    expect(mockResRevoke.status).toHaveBeenCalledWith(200)
    expect(mockResRevoke.json).toHaveBeenCalledWith({ success: true, message: 'Token revoked successfully' })
  })

  test('should return 404 if token already revoked or not found', async () => {
    vi.mocked(mockSupabase.from().update).mockImplementation(() => Promise.resolve({ error: { code: 'PGRST116' } }))

    const { default: revokeHandler } = await import('../../../../api/extension/auth/revoke.ts')
    await revokeHandler(mockReqRevoke, mockResRevoke)

    expect(mockResRevoke.status).toHaveBeenCalledWith(404)
    expect(mockResRevoke.json).toHaveBeenCalledWith({ error: 'Token not found or already revoked' })
  })

  test('should return 401 if token invalid', async () => {
    vi.mocked(jwt.verify).mockImplementation(() => { throw new Error('Invalid') })

    const { default: revokeHandler } = await import('../../../../api/extension/auth/revoke.ts')
    await revokeHandler(mockReqRevoke, mockResRevoke)

    expect(mockResRevoke.status).toHaveBeenCalledWith(401)
    expect(mockResRevoke.json).toHaveBeenCalledWith({ error: 'Invalid token' })
  })

  test('should return 405 for non-POST method', async () => {
    mockReqRevoke.method = 'GET'

    const { default: revokeHandler } = await import('../../../../api/extension/auth/revoke.ts')
    await revokeHandler(mockReqRevoke, mockResRevoke)

    expect(mockResRevoke.status).toHaveBeenCalledWith(405)
    expect(mockResRevoke.json).toHaveBeenCalledWith({ error: 'Method not allowed' })
  })
})