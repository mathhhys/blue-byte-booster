const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authenticateClerkToken } = require('../middleware/auth');
const { rateLimitMiddleware } = require('../middleware/rateLimit');
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Validate VS Code session
router.post('/session/validate', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { sessionToken, extensionVersion } = req.body;
    const { clerkUserId } = req.auth;
    console.log('VSCode Session Validate: Received sessionToken:', sessionToken);
    console.log('VSCode Session Validate: Received extensionVersion:', extensionVersion);
    console.log('VSCode Session Validate: Authenticated Clerk User ID:', clerkUserId);

    if (!sessionToken || !extensionVersion) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['sessionToken', 'extensionVersion']
      });
    }

    // Get or create VS Code session
    let session = await getOrCreateVSCodeSession(clerkUserId, sessionToken, extensionVersion);
    console.log('VSCode Session Validate: Retrieved/Created Session:', session);
    
    // Get user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id, clerk_id, plan_type, credits,
        subscriptions!inner(status, plan_type, seats)
      `)
      .eq('clerk_id', clerkUserId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Determine user permissions based on plan
    const permissions = getUserPermissions(userData.plan_type, userData.subscriptions[0]);

    res.json({
      valid: true,
      session: {
        id: session.id,
        expiresAt: session.expires_at
      },
      user: {
        clerkId: userData.clerk_id,
        planType: userData.plan_type,
        credits: userData.credits
      },
      permissions
    });

  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({ 
      error: 'Session validation failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Track model usage
router.post('/usage/track', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { sessionToken, action, modelId, tokensUsed, costInCredits } = req.body;
    const { clerkUserId } = req.auth;

    // Validate session
    const { data: session } = await supabase
      .from('vscode_sessions')
      .select('id, user_id')
      .eq('session_token', sessionToken)
      .eq('is_active', true)
      .single();

    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // Record usage
    const { error: usageError } = await supabase
      .from('model_usage')
      .insert({
        user_id: session.user_id,
        session_id: session.id,
        model_id: modelId,
        provider: 'openrouter', // or determine from modelId
        tokens_used: tokensUsed,
        credits_consumed: costInCredits,
        request_metadata: {
          action,
          timestamp: new Date().toISOString()
        }
      });

    if (usageError) {
      console.error('Usage tracking error:', usageError);
    }

    // Get updated credit balance
    const { data: userData } = await supabase
      .from('users')
      .select('credits')
      .eq('clerk_id', clerkUserId)
      .single();

    res.json({
      success: true,
      remainingCredits: userData?.credits || 0
    });

  } catch (error) {
    console.error('Usage tracking error:', error);
    res.status(500).json({ error: 'Usage tracking failed' });
  }
});

// Get user analytics
router.get('/analytics', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { clerkUserId } = req.auth;
    const { timeframe = '7d' } = req.query;

    // Calculate date range
    const timeframeDays = timeframe === '30d' ? 30 : timeframe === '1d' ? 1 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframeDays);

    // Get user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkUserId)
      .single();

    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get usage analytics
    const [modelUsage, featureUsage, creditUsage] = await Promise.all([
      // Model usage stats
      supabase
        .from('model_usage')
        .select('model_id, provider, tokens_used, credits_consumed, created_at')
        .eq('user_id', userData.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false }),

      // Feature usage stats
      supabase
        .from('feature_usage')
        .select('feature_name, usage_count, last_used_at')
        .eq('user_id', userData.id)
        .gte('last_used_at', startDate.toISOString()),

      // Credit transaction history
      supabase
        .from('credit_transactions')
        .select('amount, description, transaction_type, created_at')
        .eq('user_id', userData.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
    ]);

    // Calculate summary statistics
    const summary = {
      totalRequests: modelUsage.data?.length || 0,
      totalTokens: modelUsage.data?.reduce((sum, usage) => sum + (usage.tokens_used || 0), 0) || 0,
      totalCreditsUsed: modelUsage.data?.reduce((sum, usage) => sum + (usage.credits_consumed || 0), 0) || 0,
      uniqueModels: [...new Set(modelUsage.data?.map(usage => usage.model_id) || [])].length,
      uniqueFeatures: featureUsage.data?.length || 0
    };

    res.json({
      summary,
      modelUsage: modelUsage.data || [],
      featureUsage: featureUsage.data || [],
      creditHistory: creditUsage.data || []
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Helper functions
async function getOrCreateVSCodeSession(clerkUserId, sessionToken, extensionVersion) {
  // Try to find existing active session
  let { data: session } = await supabase
    .from('vscode_sessions')
    .select('*')
    .eq('session_token', sessionToken)
    .eq('is_active', true)
    .single();

  if (session) {
    // Update last activity
    await supabase
      .from('vscode_sessions')
      .update({ 
        last_activity_at: new Date().toISOString(),
        extension_version: extensionVersion
      })
      .eq('id', session.id);
    
    return session;
  }

  // Create new session
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', clerkUserId)
    .single();

  if (!userData) {
    throw new Error('User not found');
  }

  const { data: newSession, error } = await supabase
    .from('vscode_sessions')
    .insert({
      user_id: userData.id,
      session_token: sessionToken,
      extension_version: extensionVersion,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return newSession;
}

function getUserPermissions(planType, subscription) {
  const basePermissions = ['basic_models', 'basic_features'];
  
  switch (planType) {
    case 'pro':
      return [...basePermissions, 'advanced_models', 'priority_support'];
    case 'teams':
      return [...basePermissions, 'advanced_models', 'team_features', 'priority_support', 'analytics'];
    default:
      return basePermissions;
  }
}

module.exports = router;