import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action } = req.query;
  
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    switch (action) {
      case 'get':
        return await handleGetUser(req, res);
      case 'initialize':
        return await handleInitializeUser(req, res);
      default:
        return res.status(404).json({ error: 'Action not found' });
    }
  } catch (error) {
    console.error('User API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleGetUser(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.substring(7);

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify the token and get user data
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get additional user data from database
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('id, clerk_id, email, first_name, last_name, avatar_url, plan_type, credits, created_at')
      .eq('clerk_id', user.id)
      .single();

    if (dbError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user: userData });
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
}

async function handleInitializeUser(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.substring(7);
  const { planType = 'starter' } = req.body;

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify the token and get user data
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Initialize user in database if not exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', user.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // Not found is OK
      return res.status(500).json({ error: 'Database error' });
    }

    if (!existingUser) {
      // Create new user record
      const { error: createError } = await supabase
        .from('users')
        .insert({
          clerk_id: user.id,
          email: user.email,
          first_name: user.user_metadata?.first_name || null,
          last_name: user.user_metadata?.last_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          plan_type: planType,
          credits: planType === 'starter' ? 100 : 0, // Default credits based on plan
          created_at: new Date()
        });

      if (createError) {
        return res.status(500).json({ error: 'Failed to initialize user' });
      }
    }

    // Get the user data (either existing or newly created)
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('id, clerk_id, email, first_name, last_name, avatar_url, plan_type, credits, created_at')
      .eq('clerk_id', user.id)
      .single();

    if (fetchError || !userData) {
      return res.status(500).json({ error: 'Failed to fetch user data' });
    }

    return res.status(200).json({ 
      success: true, 
      user: userData,
      message: existingUser ? 'User already initialized' : 'User initialized successfully'
    });
  } catch (error) {
    console.error('Error initializing user:', error);
    return res.status(500).json({ error: 'Failed to initialize user' });
  }
}