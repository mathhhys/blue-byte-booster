import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { VSCodeIntegrationService } from '../utils/supabase/vscode-integration'

describe('VSCode Integration Service', () => {
  const mockClerkUser = {
    id: 'clerk_test_user_123',
    firstName: 'Test',
    lastName: 'User',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
    imageUrl: 'https://example.com/avatar.jpg'
  }

  beforeEach(async () => {
    // Clean up test data
    await cleanupTestData()
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  test('should sync Clerk user with Supabase', async () => {
    await VSCodeIntegrationService.syncClerkUser(mockClerkUser)
    
    // Verify user was created
    const credits = await VSCodeIntegrationService.getUserCredits(mockClerkUser.id)
    expect(credits).toBe(25) // New user gets 25 credits
  })

  test('should create VSCode session', async () => {
    await VSCodeIntegrationService.syncClerkUser(mockClerkUser)
    
    const sessionData = {
      userId: 'test_user_id',
      sessionId: 'test_session_123',
      accessToken: 'test_token_abc',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      clientInfo: { version: '1.0.0' }
    }

    const session = await VSCodeIntegrationService.createVSCodeSession(sessionData)
    expect(session.session_id).toBe('test_session_123')
    expect(session.is_active).toBe(true)
  })

  test('should retrieve active VSCode session', async () => {
    // Create session first
    const sessionData = {
      userId: 'test_user_id',
      sessionId: 'test_session_456',
      accessToken: 'test_token_def',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }

    await VSCodeIntegrationService.createVSCodeSession(sessionData)
    
    const retrieved = await VSCodeIntegrationService.getActiveVSCodeSession('test_session_456')
    expect(retrieved).not.toBeNull()
    expect(retrieved?.session_id).toBe('test_session_456')
  })

  test('should update session last used timestamp', async () => {
    const sessionData = {
      userId: 'test_user_id',
      sessionId: 'test_session_789',
      accessToken: 'test_token_ghi',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }

    await VSCodeIntegrationService.createVSCodeSession(sessionData)
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 100))
    
    await VSCodeIntegrationService.updateSessionLastUsed('test_session_789')
    
    const session = await VSCodeIntegrationService.getActiveVSCodeSession('test_session_789')
    expect(session?.last_used_at).toBeTruthy()
  })

  async function cleanupTestData() {
    // Implementation depends on your test database setup
    // This should clean up any test data created during tests
  }
})