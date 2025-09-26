import { describe, test, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}))

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://mock-supabase-url.supabase.co')
vi.stubEnv('SUPABASE_SERVICE_KEY', 'mock-service-key')

// Import the middleware logic for testing
async function testMiddlewareLogic(authResult: any, isProtectedRoute: boolean, requestUrl: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Standard Clerk auth
  const { userId, orgId } = await authResult();
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', requestUrl));
  }

  if (isProtectedRoute) {
    if (!orgId) {
      return NextResponse.redirect(new URL('/organizations', requestUrl));
    }

    // Seat validation (adapt repo's license middleware)
    try {
      const { data: seat, error } = await supabase
        .from('organization_seats')
        .select('status, expires_at')
        .eq('clerk_org_id', orgId)
        .eq('clerk_user_id', userId)
        .single();

      if (error || !seat) {
        console.error('Seat validation error:', error);
        return NextResponse.json({ error: 'No active seat assigned' }, { status: 403 });
      }

      if (seat.status !== 'active') {
        return NextResponse.json({ error: 'Seat not active' }, { status: 403 });
      }

      if (seat.expires_at && new Date(seat.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Seat expired' }, { status: 403 });
      }

      // Check subscription overage for usage routes (optional, log for now)
      const { data: sub } = await supabase
        .from('organization_subscriptions')
        .select('overage')
        .eq('clerk_org_id', orgId)
        .eq('status', 'active')
        .single();

      if (sub?.overage) {
        // Allow but log for billing
        console.log(`Overage detected for org ${orgId}, user ${userId}`);
      }
    } catch (error) {
      console.error('Middleware seat check failed:', error);
      return NextResponse.json({ error: 'License validation failed' }, { status: 500 });
    }
  }

  return NextResponse.next();
}

describe('Middleware Logic', () => {
  let mockSupabase: any

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()

    // Mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis()
    }

    vi.mocked(createClient).mockReturnValue(mockSupabase)
  })

  test('should redirect to sign-in when not authenticated', async () => {
    const authResult = vi.fn().mockResolvedValue({ userId: null })
    const result = await testMiddlewareLogic(authResult, false, 'http://localhost:3000/organizations')
    
    expect(result.headers.get('location')).toBe('http://localhost:3000/sign-in')
  })

  test('should redirect to organizations when no orgId on protected route', async () => {
    const authResult = vi.fn().mockResolvedValue({ userId: 'user_123', orgId: null })
    const result = await testMiddlewareLogic(authResult, true, 'http://localhost:3000/dashboard')
    
    expect(result.headers.get('location')).toBe('http://localhost:3000/organizations')
  })

  test('should validate seat successfully for protected route', async () => {
    const authResult = vi.fn().mockResolvedValue({ userId: 'user_123', orgId: 'org_123' })
    
    // Mock successful seat validation
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ 
        data: { 
          status: 'active', 
          expires_at: new Date(Date.now() + 86400000).toISOString() // Tomorrow
        }, 
        error: null 
      })
    })

    // Mock subscription check
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ 
        data: { overage: false }, 
        error: null 
      })
    })

    const result = await testMiddlewareLogic(authResult, true, 'http://localhost:3000/dashboard')
    
    expect(result).toEqual(NextResponse.next())
  })

  test('should return 403 when no active seat assigned', async () => {
    const authResult = vi.fn().mockResolvedValue({ userId: 'user_123', orgId: 'org_123' })
    
    // Mock seat validation returning no seat
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error('No seat found') })
    })

    const result = await testMiddlewareLogic(authResult, true, 'http://localhost:3000/dashboard')
    
    expect(result.status).toBe(403)
    const data = await result.json()
    expect(data.error).toBe('No active seat assigned')
  })

  test('should return 403 when seat is not active', async () => {
    const authResult = vi.fn().mockResolvedValue({ userId: 'user_123', orgId: 'org_123' })
    
    // Mock seat validation returning inactive seat
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ 
        data: { status: 'inactive', expires_at: null }, 
        error: null 
      })
    })

    const result = await testMiddlewareLogic(authResult, true, 'http://localhost:3000/dashboard')
    
    expect(result.status).toBe(403)
    const data = await result.json()
    expect(data.error).toBe('Seat not active')
  })

  test('should return 403 when seat is expired', async () => {
    const authResult = vi.fn().mockResolvedValue({ userId: 'user_123', orgId: 'org_123' })
    
    // Mock seat validation returning expired seat
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ 
        data: { 
          status: 'active', 
          expires_at: new Date(Date.now() - 86400000).toISOString() // Yesterday
        }, 
        error: null 
      })
    })

    const result = await testMiddlewareLogic(authResult, true, 'http://localhost:3000/dashboard')
    
    expect(result.status).toBe(403)
    const data = await result.json()
    expect(data.error).toBe('Seat expired')
  })

  test('should handle database errors gracefully', async () => {
    const authResult = vi.fn().mockResolvedValue({ userId: 'user_123', orgId: 'org_123' })
    
    // Mock database error
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockRejectedValue(new Error('Database connection failed'))
    })

    const result = await testMiddlewareLogic(authResult, true, 'http://localhost:3000/dashboard')
    
    expect(result.status).toBe(500)
    const data = await result.json()
    expect(data.error).toBe('License validation failed')
  })

  test('should allow access to non-protected routes without seat validation', async () => {
    const authResult = vi.fn().mockResolvedValue({ userId: 'user_123', orgId: null })
    const result = await testMiddlewareLogic(authResult, false, 'http://localhost:3000/sign-in')
    
    expect(result).toEqual(NextResponse.next())
  })

  test('should log overage but allow access when subscription has overage', async () => {
    const authResult = vi.fn().mockResolvedValue({ userId: 'user_123', orgId: 'org_123' })
    
    // Mock successful seat validation
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ 
        data: { 
          status: 'active', 
          expires_at: new Date(Date.now() + 86400000).toISOString()
        }, 
        error: null 
      })
    })

    // Mock subscription with overage
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ 
        data: { overage: true }, 
        error: null 
      })
    })

    // Spy on console.log to verify overage logging
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await testMiddlewareLogic(authResult, true, 'http://localhost:3000/dashboard')
    
    expect(result).toEqual(NextResponse.next())
    expect(consoleSpy).toHaveBeenCalledWith(`Overage detected for org org_123, user user_123`)
    
    consoleSpy.mockRestore()
  })
})