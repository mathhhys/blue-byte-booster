import { describe, test, expect, vi, beforeEach } from 'vitest'
import { GET, POST, DELETE } from '../../../api/organization/seats/route'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@clerk/nextjs/server', () => ({
  getAuth: vi.fn()
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}))

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock-supabase-url.supabase.co')
vi.stubEnv('SUPABASE_SERVICE_KEY', 'mock-service-key')

describe('Organization Seats API', () => {
  let mockSupabase: any
  let mockGetAuth: any

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()

    // Mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      rpc: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis()
    }

    // Mock createClient to return our mock Supabase
    const supabaseModule = require('@supabase/supabase-js')
    supabaseModule.createClient.mockReturnValue(mockSupabase)

    // Mock getAuth function
    const clerkModule = require('@clerk/nextjs/server')
    mockGetAuth = vi.fn()
    clerkModule.getAuth.mockImplementation(mockGetAuth)
  })

  test('should return 400 if orgId is missing', async () => {
    // Mock auth to return a user
    mockGetAuth.mockResolvedValue({ userId: 'user_123' })
    
    const request = new NextRequest('http://localhost:3000/api/organization/seats')
    const response = await GET(request)
    
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Organization ID required')
  })

  test('should return 401 if not authenticated', async () => {
    // Mock auth to return no user
    mockGetAuth.mockResolvedValue({ userId: null })
    
    const request = new NextRequest('http://localhost:3000/api/organization/seats?orgId=org_123')
    const response = await GET(request)
    
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  test('should fetch seats and usages successfully', async () => {
    // Mock auth to return a user
    mockGetAuth.mockResolvedValue({ userId: 'user_123' })
    
    const mockSeats = [{ id: 1, clerk_org_id: 'org_123', status: 'active' }]
    const mockUsages = [{ id: 1, organization_id: 1, usage_count: 10 }]
    const mockOrg = { id: 1 }

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'organization_seats') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: vi.fn().mockResolvedValue({ data: mockSeats, error: null })
              })
            })
          })
        }
      }
      if (table === 'license_usages') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                single: vi.fn().mockResolvedValue({ data: mockUsages, error: null })
              })
            })
          })
        }
      }
      if (table === 'organizations') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: mockOrg, error: null })
            })
          })
        }
      }
      return mockSupabase
    })

    const request = new NextRequest('http://localhost:3000/api/organization/seats?orgId=org_123')
    const response = await GET(request)
    
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.seats).toEqual(mockSeats)
    expect(data.usages).toEqual(mockUsages)
  })

  test('should handle database errors', async () => {
    // Mock auth to return a user
    mockGetAuth.mockResolvedValue({ userId: 'user_123' })
    
    mockSupabase.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Database error') })
          })
        })
      })
    })

    const request = new NextRequest('http://localhost:3000/api/organization/seats?orgId=org_123')
    const response = await GET(request)
    
    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Failed to fetch seats')
  })

  test('should return 400 if orgId or userEmail is missing', async () => {
    // Mock auth to return a user
    mockGetAuth.mockResolvedValue({ userId: 'user_123' })
    
    const request = new NextRequest('http://localhost:3000/api/organization/seats', {
      method: 'POST',
      headers: new Headers({}),
      body: JSON.stringify({})
    })
    const response = await POST(request)
    
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Organization ID and user email required')
  })

  test('should return 401 if not authenticated', async () => {
    // Mock auth to return no user
    mockGetAuth.mockResolvedValue({ userId: null })
    
    const request = new NextRequest('http://localhost:3000/api/organization/seats', {
      method: 'POST',
      headers: new Headers({ 'x-clerk-org-id': 'org_123' }),
      body: JSON.stringify({ userEmail: 'test@example.com' })
    })
    const response = await POST(request)
    
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  test('should assign seat successfully', async () => {
    // Mock auth to return a user
    mockGetAuth.mockResolvedValue({ userId: 'user_123' })
    
    mockSupabase.rpc.mockResolvedValue({ data: { success: true }, error: null })

    const request = new NextRequest('http://localhost:3000/api/organization/seats', {
      method: 'POST',
      headers: new Headers({ 'x-clerk-org-id': 'org_123' }),
      body: JSON.stringify({ 
        userEmail: 'test@example.com',
        userName: 'Test User',
        expiresAt: '2024-12-31'
      })
    })
    const response = await POST(request)
    
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.message).toBe('Seat assigned')

    // Verify RPC call with correct parameters
    expect(mockSupabase.rpc).toHaveBeenCalledWith('assign_organization_seat', {
      p_clerk_org_id: 'org_123',
      p_clerk_user_id: 'user_123',
      p_user_email: 'test@example.com',
      p_user_name: 'Test User',
      p_assigned_by: 'user_123',
      p_expires_at: '2024-12-31'
    })
  })

  test('should handle RPC errors', async () => {
    // Mock auth to return a user
    mockGetAuth.mockResolvedValue({ userId: 'user_123' })
    
    mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('RPC error') })

    const request = new NextRequest('http://localhost:3000/api/organization/seats', {
      method: 'POST',
      headers: new Headers({ 'x-clerk-org-id': 'org_123' }),
      body: JSON.stringify({ userEmail: 'test@example.com' })
    })
    const response = await POST(request)
    
    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Failed to assign seat')
  })

  test('should handle no data returned from RPC', async () => {
    // Mock auth to return a user
    mockGetAuth.mockResolvedValue({ userId: 'user_123' })
    
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

    const request = new NextRequest('http://localhost:3000/api/organization/seats', {
      method: 'POST',
      headers: new Headers({ 'x-clerk-org-id': 'org_123' }),
      body: JSON.stringify({ userEmail: 'test@example.com' })
    })
    const response = await POST(request)
    
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Failed to assign seat (no subscription or limit reached)')
  })

  test('should return 400 if orgId or userId is missing', async () => {
    // Mock auth to return a user
    mockGetAuth.mockResolvedValue({ userId: 'user_123' })
    
    const request = new NextRequest('http://localhost:3000/api/organization/seats', {
      method: 'DELETE'
    })
    const response = await DELETE(request)
    
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Organization ID and user ID required')
  })

  test('should return 401 if not authenticated', async () => {
    // Mock auth to return no user
    mockGetAuth.mockResolvedValue({ userId: null })
    
    const request = new NextRequest('http://localhost:3000/api/organization/seats?userId=user_456', {
      method: 'DELETE',
      headers: new Headers({ 'x-clerk-org-id': 'org_123' })
    })
    const response = await DELETE(request)
    
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  test('should revoke seat successfully', async () => {
    // Mock auth to return a user
    mockGetAuth.mockResolvedValue({ userId: 'user_123' })
    
    mockSupabase.rpc.mockResolvedValue({ data: { success: true }, error: null })

    const request = new NextRequest('http://localhost:3000/api/organization/seats?userId=user_456', {
      method: 'DELETE',
      headers: new Headers({ 'x-clerk-org-id': 'org_123' })
    })
    const response = await DELETE(request)
    
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.message).toBe('Seat revoked')

    // Verify RPC call with correct parameters
    expect(mockSupabase.rpc).toHaveBeenCalledWith('remove_organization_seat', {
      p_clerk_org_id: 'org_123',
      p_clerk_user_id: 'user_456'
    })
  })

  test('should handle RPC errors', async () => {
    // Mock auth to return a user
    mockGetAuth.mockResolvedValue({ userId: 'user_123' })
    
    mockSupabase.rpc.mockResolvedValue({ data: null, error: new Error('RPC error') })

    const request = new NextRequest('http://localhost:3000/api/organization/seats?userId=user_456', {
      method: 'DELETE',
      headers: new Headers({ 'x-clerk-org-id': 'org_123' })
    })
    const response = await DELETE(request)
    
    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Failed to revoke seat')
  })

  test('should handle no data returned from RPC', async () => {
    // Mock auth to return a user
    mockGetAuth.mockResolvedValue({ userId: 'user_123' })
    
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

    const request = new NextRequest('http://localhost:3000/api/organization/seats?userId=user_456', {
      method: 'DELETE',
      headers: new Headers({ 'x-clerk-org-id': 'org_123' })
    })
    const response = await DELETE(request)
    
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Failed to revoke seat')
  })
})