import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface VSCodeSession {
  id: string
  user_id: string
  session_id: string
  access_token: string
  refresh_token?: string
  expires_at: string
  client_info: any
  created_at: string
  last_used_at: string
  is_active: boolean
}

export class VSCodeIntegrationService {
  
  static async syncClerkUser(clerkUser: any): Promise<void> {
    const userData = {
      clerk_id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress,
      name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || null,
      avatar_url: clerkUser.imageUrl,
      last_vscode_login: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, credits')
      .eq('clerk_id', clerkUser.id)
      .single()

    if (existingUser) {
      // Update existing user
      const { error } = await supabase
        .from('users')
        .update(userData)
        .eq('clerk_id', clerkUser.id)

      if (error) throw error
    } else {
      // Create new user with starter credits
      const { error } = await supabase
        .from('users')
        .insert({ ...userData, credits: 25 })

      if (error) throw error
    }
  }

  static async createVSCodeSession(data: {
    userId: string
    sessionId: string
    accessToken: string
    expiresAt: Date
    clientInfo?: any
  }): Promise<VSCodeSession> {
    
    const sessionData = {
      user_id: data.userId,
      session_id: data.sessionId,
      access_token: data.accessToken,
      expires_at: data.expiresAt.toISOString(),
      client_info: data.clientInfo || {},
      created_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
      is_active: true
    }

    const { data: session, error } = await supabase
      .from('vscode_sessions')
      .insert(sessionData)
      .select()
      .single()

    if (error) throw error
    return session
  }

  static async getActiveVSCodeSession(sessionId: string): Promise<VSCodeSession | null> {
    const { data, error } = await supabase
      .from('vscode_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  }

  static async updateSessionLastUsed(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('vscode_sessions')
      .update({ 
        last_used_at: new Date().toISOString() 
      })
      .eq('session_id', sessionId)

    if (error) throw error
  }

  static async deactivateVSCodeSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('vscode_sessions')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)

    if (error) throw error
  }

  static async getUserCredits(clerkId: string): Promise<number> {
    const { data, error } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', clerkId)
      .single()

    if (error) throw error
    return data?.credits || 0
  }

  static async updateUserCredits(clerkId: string, credits: number): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ 
        credits,
        updated_at: new Date().toISOString()
      })
      .eq('clerk_id', clerkId)

    if (error) throw error
  }
}
