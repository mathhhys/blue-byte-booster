import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Mock dependencies
jest.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: jest.fn(),
  createRouteMatcher: jest.fn()
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-supabase-url.supabase.co'
process.env.SUPABASE_SERVICE_KEY = 'mock-service-key'

// Define the auth function type for clarity
type AuthFunction = () => Promise<{ userId: string | null; orgId: string | null }>

describe('Middleware', () => {
  let mockSupabase: any
  let mockCreateRouteMatcher: any

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()

    // Mock Supabase client with basic setup
    mockSupabase = {
      from: jest.fn()
    }

    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

    // Mock route matcher
    mockCreateRouteMatcher = jest.fn().mockReturnValue(jest.fn().mockReturnValue(false))
    const clerkModule = require('@clerk/nextjs/server')
    clerkModule.createRouteMatcher.mockReturnValue(mockCreateRouteMatcher)
  })

  test('should redirect to sign-in when not authenticated', async () => {
    // Mock auth to return no user
    const mockAuth: AuthFunction = jest.fn().mockResolvedValue({ userId: null })
    
    // Import the handler function directly
    const { seatValidationHandler } = await import('../../middleware')
    
    // Create a mock request
    const request = new NextRequest('http://localhost:3000/organizations')
    
    // Execute the handler directly with mocked auth
    const result = await seatValidationHandler(mockAuth, request)
    
    expect(result).toEqual(NextResponse.redirect(new URL('/sign-in', request.url)))
  })

  test('should redirect to organizations when no orgId on protected route', async () => {
    // Mock auth to return user but no org
    const mockAuth: AuthFunction = jest.fn().mockResolvedValue({ userId: 'user_123', orgId: null })
    
    // Mock route matcher to return true for protected route
    mockCreateRouteMatcher.mockReturnValue(jest.fn().mockReturnValue(true))
    
    // Import the handler function directly
    const { seatValidationHandler } = await import('../../middleware')
    
    // Create a mock request
    const request = new NextRequest('http://localhost:3000/organizations')
    
    // Execute the handler directly with mocked auth
    const result = await seatValidationHandler(mockAuth, request)
    
    expect(result).toEqual(NextResponse.redirect(new URL('/organizations', request.url)))
  })

  test('should validate seat successfully for protected route', async () => {
    // Mock auth to return user and org
    const mockAuth: AuthFunction = jest.fn().mockResolvedValue({ userId: 'user_123', orgId: 'org_123' })
    
    // Mock route matcher to return true for protected route
    mockCreateRouteMatcher.mockReturnValue(jest.fn().mockReturnValue(true))
    
    // Mock successful seat validation and subscription check
    mockSupabase.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            status: 'active',
            expires_at: new Date(Date.now() + 86400000).toISOString() // Tomorrow
          },
          error: null
        })
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { overage: false },
          error: null
        })
      })

    // Import the handler function directly
    const { seatValidationHandler } = await import('../../middleware')
    
    // Create a mock request
    const request = new NextRequest('http://localhost:3000/dashboard')
    
    // Execute the handler directly with mocked auth
    const result = await seatValidationHandler(mockAuth, request)
    
    // NextResponse.next() returns a NextResponse object, so we check for that
    expect(result).toBeInstanceOf(NextResponse)
  })

  test('should return 403 when no active seat assigned', async () => {
    // Mock auth to return user and org
    const mockAuth: AuthFunction = jest.fn().mockResolvedValue({ userId: 'user_123', orgId: 'org_123' })
    
    // Mock route matcher to return true for protected route
    mockCreateRouteMatcher.mockReturnValue(jest.fn().mockReturnValue(true))
    
    // Mock seat validation returning no seat
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: new Error('No seat found') })
    })

    // Import the handler function directly
    const { seatValidationHandler } = await import('../../middleware')
    
    // Create a mock request
    const request = new NextRequest('http://localhost:3000/dashboard')
    
    // Execute the handler directly with mocked auth
    const result = await seatValidationHandler(mockAuth, request)
    
    // Check that it's a JSON response with status 403
    expect(result.status).toBe(403)
    expect(result.headers.get('content-type')).toBe('application/json')
    const data = await result.json()
    expect(data.error).toBe('No active seat assigned')
  })

  test('should return 403 when seat is not active', async () => {
    // Mock auth to return user and org
    const mockAuth: AuthFunction = jest.fn().mockResolvedValue({ userId: 'user_123', orgId: 'org_123' })
    
    // Mock route matcher to return true for protected route
    mockCreateRouteMatcher.mockReturnValue(jest.fn().mockReturnValue(true))
    
    // Mock seat validation returning inactive seat (no error, but inactive status)
    mockSupabase.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { status: 'inactive', expires_at: null },
        error: null
      })
    }))

    // Import the handler function directly
    const { seatValidationHandler } = await import('../../middleware')
    
    // Create a mock request
    const request = new NextRequest('http://localhost:3000/dashboard')
    
    // Execute the handler directly with mocked auth
    const result = await seatValidationHandler(mockAuth, request)
    
    // Check that it's a JSON response with status 403
    expect(result.status).toBe(403)
    expect(result.headers.get('content-type')).toBe('application/json')
    const data = await result.json()
    expect(data.error).toBe('Seat not active')
  })

  test('should return 403 when seat is expired', async () => {
    // Mock auth to return user and org
    const mockAuth: AuthFunction = jest.fn().mockResolvedValue({ userId: 'user_123', orgId: 'org_123' })
    
    // Mock route matcher to return true for protected route
    mockCreateRouteMatcher.mockReturnValue(jest.fn().mockReturnValue(true))
    
    // Mock seat validation returning expired seat (no error, but expired)
    mockSupabase.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          status: 'active',
          expires_at: new Date(Date.now() - 86400000).toISOString() // Yesterday
        },
        error: null
      })
    }))

    // Import the handler function directly
    const { seatValidationHandler } = await import('../../middleware')
    
    // Create a mock request
    const request = new NextRequest('http://localhost:3000/dashboard')
    
    // Execute the handler directly with mocked auth
    const result = await seatValidationHandler(mockAuth, request)
    
    // Check that it's a JSON response with status 403
    expect(result.status).toBe(403)
    expect(result.headers.get('content-type')).toBe('application/json')
    const data = await result.json()
    expect(data.error).toBe('Seat expired')
  })

  test('should handle database errors gracefully', async () => {
    // Mock auth to return user and org
    const mockAuth: AuthFunction = jest.fn().mockResolvedValue({ userId: 'user_123', orgId: 'org_123' })
    
    // Mock route matcher to return true for protected route
    mockCreateRouteMatcher.mockReturnValue(jest.fn().mockReturnValue(true))
    
    // Mock database error - the error should happen on the single() call
    mockSupabase.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockRejectedValue(new Error('Database connection failed'))
    }))

    // Import the handler function directly
    const { seatValidationHandler } = await import('../../middleware')
    
    // Create a mock request
    const request = new NextRequest('http://localhost:3000/dashboard')
    
    // Execute the handler directly with mocked auth
    const result = await seatValidationHandler(mockAuth, request)
    
    // Check that it's a JSON response with status 500
    expect(result.status).toBe(500)
    expect(result.headers.get('content-type')).toBe('application/json')
    const data = await result.json()
    expect(data.error).toBe('License validation failed')
  })

  test('should allow access to non-protected routes without seat validation', async () => {
    // Mock auth to return user but no org
    const mockAuth: AuthFunction = jest.fn().mockResolvedValue({ userId: 'user_123', orgId: null })
    
    // Mock route matcher to return false for non-protected route
    mockCreateRouteMatcher.mockReturnValue(jest.fn().mockReturnValue(false))

    // Import the handler function directly
    const { seatValidationHandler } = await import('../../middleware')
    
    // Create a mock request for a non-protected route
    const request = new NextRequest('http://localhost:3000/sign-in')
    
    // Execute the handler directly with mocked auth
    const result = await seatValidationHandler(mockAuth, request)
    
    // NextResponse.next() returns a NextResponse object, so we check for that
    expect(result).toBeInstanceOf(NextResponse)
  })

  test('should log overage but allow access when subscription has overage', async () => {
    // Mock auth to return user and org
    const mockAuth: AuthFunction = jest.fn().mockResolvedValue({ userId: 'user_123', orgId: 'org_123' })
    
    // Mock route matcher to return true for protected route
    mockCreateRouteMatcher.mockReturnValue(jest.fn().mockReturnValue(true))
    
    // Mock successful seat validation and subscription with overage
    mockSupabase.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            status: 'active',
            expires_at: new Date(Date.now() + 86400000).toISOString()
          },
          error: null
        })
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { overage: true },
          error: null
        })
      })

    // Spy on console.log to verify overage logging
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    // Import the handler function directly
    const { seatValidationHandler } = await import('../../middleware')
    
    // Create a mock request
    const request = new NextRequest('http://localhost:3000/dashboard')
    
    // Execute the handler directly with mocked auth
    const result = await seatValidationHandler(mockAuth, request)
    
    // NextResponse.next() returns a NextResponse object, so we check for that
    expect(result).toBeInstanceOf(NextResponse)
    expect(consoleSpy).toHaveBeenCalledWith(`Overage detected for org org_123, user user_123`)
    
    consoleSpy.mockRestore()
  })
})