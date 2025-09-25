const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to get user by Clerk ID
async function getUserByClerkId(clerkId) {
  console.log('routes/user.js: Searching for user with Clerk ID:', clerkId);
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_id', clerkId)
    .single();

  console.log('routes/user.js: Database query result:', { data: !!data, error });

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('routes/user.js: No user found with Clerk ID:', clerkId);
      return { data: null, error: null };
    }
    console.error('routes/user.js: Database query error:', error);
    return { data: null, error };
  }

  if (data) {
    console.log('routes/user.js: Found user:', { id: data.id, email: data.email, plan_type: data.plan_type });
    return { data, error: null };
  } else {
    console.log('routes/user.js: No user found with Clerk ID:', clerkId);
    return { data: null, error: null };
  }
}

// Helper function to upsert user
async function upsertUser(userData) {
  try {
    console.log('routes/user.js: Upserting user:', { clerk_id: userData.clerk_id, email: userData.email });
    
    const { data, error } = await supabase.rpc('upsert_user', {
      p_clerk_id: userData.clerk_id,
      p_email: userData.email,
      p_first_name: userData.first_name || null,
      p_last_name: userData.last_name || null,
      p_avatar_url: userData.avatar_url || null,
      p_plan_type: userData.plan_type || 'starter'
    });

    if (error) throw error;

    // Fetch the complete user record
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', userData.clerk_id)
      .single();

    return { data: user, error: fetchError };
  } catch (error) {
    console.error('routes/user.js: Upsert error:', error);
    return { data: null, error };
  }
}

// GET /api/user/get?clerkId=...
router.get('/get', async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clerkId } = req.query;

  if (!clerkId) {
    return res.status(400).json({ error: 'Clerk ID is required' });
  }

  try {
    console.log('routes/user.js: API: Getting user for Clerk ID:', clerkId);
    const { data, error } = await getUserByClerkId(clerkId);

    if (error) {
      console.error('routes/user.js: API: Database error:', error);
      return res.status(500).json({ error: 'Database error', details: error });
    }

    console.log('routes/user.js: API: User found:', !!data);
    return res.status(200).json({ data, error: null });
  } catch (error) {
    console.error('routes/user.js: API: Exception:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/user/initialize
router.post('/initialize', async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clerkUser, planType = 'starter' } = req.body;

  if (!clerkUser || !clerkUser.id || !clerkUser.emailAddresses?.[0]?.emailAddress) {
    return res.status(400).json({ error: 'Valid Clerk user data is required' });
  }

  try {
    console.log('routes/user.js: API: Initializing user for Clerk ID:', clerkUser.id);
    
    const upsertData = {
      clerk_id: clerkUser.id,
      email: clerkUser.emailAddresses[0].emailAddress,
      first_name: clerkUser.firstName || null,
      last_name: clerkUser.lastName || null,
      avatar_url: clerkUser.imageUrl || null,
      plan_type: planType
    };

    const { data: user, error } = await upsertUser(upsertData);

    if (error) {
      console.error('routes/user.js: API: Initialization error:', error);
      return res.status(500).json({ error: 'Initialization error', details: error });
    }

    console.log('routes/user.js: API: User initialized successfully');
    return res.status(200).json({ user, error: null });
  } catch (error) {
    console.error('routes/user.js: API: Exception during initialization:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;