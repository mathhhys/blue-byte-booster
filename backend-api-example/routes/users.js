const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { authenticateClerkToken } = require('../middleware/auth');
const { rateLimitMiddleware } = require('../middleware/rateLimit');
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get user profile with enhanced VS Code integration data
router.get('/:clerkUserId/profile', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    
    // Verify user can access this profile (either own profile or admin)
    if (req.auth.clerkUserId !== clerkUserId && !req.auth.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get comprehensive user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id, clerk_id, email, first_name, last_name, plan_type, credits,
        last_vscode_activity_at, vscode_extension_version, integration_preferences,
        total_api_requests, last_api_request_at, created_at, updated_at,
        subscriptions!inner(
          id, status, plan_type, billing_frequency, seats, 
          next_billing_date, feature_flags
        )
      `)
      .eq('clerk_id', clerkUserId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get recent usage statistics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [usageStats, creditHistory] = await Promise.all([
      // Usage statistics
      supabase
        .from('model_usage')
        .select('credits_consumed, tokens_used, created_at')
        .eq('user_id', userData.id)
        .gte('created_at', thirtyDaysAgo.toISOString()),

      // Recent credit transactions
      supabase
        .from('credit_transactions')
        .select('amount, description, transaction_type, created_at')
        .eq('user_id', userData.id)
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

    // Calculate usage summary
    const usageSummary = {
      totalCreditsUsed: usageStats.data?.reduce((sum, usage) => sum + (usage.credits_consumed || 0), 0) || 0,
      totalTokens: usageStats.data?.reduce((sum, usage) => sum + (usage.tokens_used || 0), 0) || 0,
      totalRequests: usageStats.data?.length || 0,
      avgCreditsPerDay: usageStats.data?.length > 0 ? 
        (usageStats.data.reduce((sum, usage) => sum + (usage.credits_consumed || 0), 0) / 30).toFixed(2) : 0
    };

    const response = {
      user: {
        clerkId: userData.clerk_id,
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        planType: userData.plan_type,
        credits: userData.credits,
        lastVSCodeActivity: userData.last_vscode_activity_at,
        extensionVersion: userData.vscode_extension_version,
        totalApiRequests: userData.total_api_requests,
        lastApiRequest: userData.last_api_request_at,
        createdAt: userData.created_at,
        integrationPreferences: userData.integration_preferences
      },
      subscription: userData.subscriptions?.[0] ? {
        id: userData.subscriptions[0].id,
        status: userData.subscriptions[0].status,
        planType: userData.subscriptions[0].plan_type,
        billingFrequency: userData.subscriptions[0].billing_frequency,
        seats: userData.subscriptions[0].seats,
        nextBillingDate: userData.subscriptions[0].next_billing_date,
        featureFlags: userData.subscriptions[0].feature_flags
      } : null,
      usage: usageSummary,
      recentTransactions: creditHistory.data || []
    };

    res.json(response);

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Consume credits with enhanced tracking
router.post('/:clerkUserId/credits/consume', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    const { amount, description, metadata = {}, sessionId, modelId, provider, tokensUsed } = req.body;

    // Verify user can consume credits for this account
    if (req.auth.clerkUserId !== clerkUserId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!amount || amount <= 0 || !description) {
      return res.status(400).json({ 
        error: 'Invalid parameters',
        required: ['amount (positive number)', 'description']
      });
    }

    // Check if user is in an organization with active subscription
    const { data: orgMembership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('clerk_user_id', clerkUserId)
      .single();

    let result;
    if (membershipError && membershipError.code !== 'PGRST116') { // No rows
      throw membershipError;
    }

    if (orgMembership) {
      const { data: subscription, error: subError } = await supabase
        .from('organization_subscriptions')
        .select('id')
        .eq('organization_id', orgMembership.organization_id)
        .eq('status', 'active')
        .single();

      if (subError) {
        throw subError;
      }

      if (subscription) {
        // Deduct from org pool
        const { data: deductData, error: deductError } = await supabase.rpc('deduct_org_credits', {
          p_clerk_org_id: orgMembership.organization_id,
          p_credits_amount: amount
        });

        if (deductError || !deductData) {
          return res.status(402).json({ error: 'Insufficient organization credits' });
        }

        result = {
          success: true,
          current_credits: deductData.remaining_credits,
          credits_consumed: amount,
          description: description,
          type: 'org_pool_usage'
        };
      } else {
        // Fall back to individual
        const { data: deductData, error: deductError } = await supabase.rpc('consume_credits_with_session', {
          p_clerk_id: clerkUserId,
          p_amount: amount,
          p_description: description,
          p_session_id: sessionId || null,
          p_model_id: modelId || null,
          p_provider: provider || null,
          p_tokens_used: tokensUsed || null,
          p_metadata: metadata
        });

        if (deductError) {
          throw deductError;
        }

        result = deductData;
      }
    } else {
      // No org, use individual
      const { data: deductData, error: deductError } = await supabase.rpc('consume_credits_with_session', {
        p_clerk_id: clerkUserId,
        p_amount: amount,
        p_description: description,
        p_session_id: sessionId || null,
        p_model_id: modelId || null,
        p_provider: provider || null,
        p_tokens_used: tokensUsed || null,
        p_metadata: metadata
      });

      if (deductError) {
        throw deductError;
      }

      result = deductData;
    }

    if (error) {
      console.error('Credit consumption error:', error);
      return res.status(500).json({ error: 'Credit consumption failed' });
    }

    if (!result.success) {
      const statusCode = result.error_code === 'INSUFFICIENT_CREDITS' ? 402 : 400;
      return res.status(statusCode).json({
        error: result.error,
        code: result.error_code,
        currentCredits: result.current_credits,
        requiredCredits: result.required_credits
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Credit consumption error:', error);
    res.status(500).json({ error: 'Credit consumption failed' });
  }
});

// Get user usage statistics
router.get('/:clerkUserId/usage/stats', authenticateClerkToken, rateLimitMiddleware, async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    const { period = '7d', groupBy = 'day' } = req.query;

    // Verify access
    if (req.auth.clerkUserId !== clerkUserId && !req.auth.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Calculate period
    const days = period === '30d' ? 30 : period === '1d' ? 1 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user ID
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkUserId)
      .single();

    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get detailed usage statistics
    const { data: usageData, error } = await supabase
      .from('model_usage')
      .select(`
        model_id, provider, tokens_used, credits_consumed, 
        success, created_at
      `)
      .eq('user_id', userData.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Usage stats error:', error);
      return res.status(500).json({ error: 'Failed to fetch usage statistics' });
    }

    // Group and aggregate data
    const groupedData = groupUsageData(usageData || [], groupBy);
    const modelStats = aggregateByModel(usageData || []);
    const providerStats = aggregateByProvider(usageData || []);

    res.json({
      period,
      groupBy,
      timeline: groupedData,
      byModel: modelStats,
      byProvider: providerStats,
      totals: {
        requests: usageData?.length || 0,
        tokens: usageData?.reduce((sum, usage) => sum + (usage.tokens_used || 0), 0) || 0,
        credits: usageData?.reduce((sum, usage) => sum + (usage.credits_consumed || 0), 0) || 0,
        successRate: usageData?.length > 0 ? 
          (usageData.filter(u => u.success).length / usageData.length * 100).toFixed(2) : 100
      }
    });

  } catch (error) {
    console.error('Usage stats error:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

// Helper functions for data aggregation
function groupUsageData(data, groupBy) {
  const grouped = {};
  
  data.forEach(usage => {
    let key;
    const date = new Date(usage.created_at);
    
    switch (groupBy) {
      case 'hour':
        key = date.toISOString().slice(0, 13) + ':00:00.000Z';
        break;
      case 'day':
        key = date.toISOString().slice(0, 10);
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().slice(0, 10);
        break;
      default:
        key = date.toISOString().slice(0, 10);
    }
    
    if (!grouped[key]) {
      grouped[key] = {
        period: key,
        requests: 0,
        tokens: 0,
        credits: 0,
        errors: 0
      };
    }
    
    grouped[key].requests += 1;
    grouped[key].tokens += usage.tokens_used || 0;
    grouped[key].credits += usage.credits_consumed || 0;
    if (!usage.success) grouped[key].errors += 1;
  });
  
  return Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
}

function aggregateByModel(data) {
  const models = {};
  
  data.forEach(usage => {
    const modelId = usage.model_id;
    if (!models[modelId]) {
      models[modelId] = {
        modelId,
        requests: 0,
        tokens: 0,
        credits: 0,
        errors: 0
      };
    }
    
    models[modelId].requests += 1;
    models[modelId].tokens += usage.tokens_used || 0;
    models[modelId].credits += usage.credits_consumed || 0;
    if (!usage.success) models[modelId].errors += 1;
  });
  
  return Object.values(models).sort((a, b) => b.requests - a.requests);
}

function aggregateByProvider(data) {
  const providers = {};
  
  data.forEach(usage => {
    const provider = usage.provider;
    if (!providers[provider]) {
      providers[provider] = {
        provider,
        requests: 0,
        tokens: 0,
        credits: 0,
        errors: 0
      };
    }
    
    providers[provider].requests += 1;
    providers[provider].tokens += usage.tokens_used || 0;
    providers[provider].credits += usage.credits_consumed || 0;
    if (!usage.success) providers[provider].errors += 1;
  });
  
  return Object.values(providers).sort((a, b) => b.requests - a.requests);
}

// Get user subscription
router.get('/subscription', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('Getting subscription for user:', userId);

    // Get user subscription from database
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        users (
          email,
          stripe_customer_id
        )
      `)
      .eq('user_id', (
        supabase
          .from('users')
          .select('id')
          .eq('clerk_id', userId)
          .single()
      ))
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!subscription) {
      return res.json({
        hasSubscription: false,
        subscription: null
      });
    }

    res.json({
      hasSubscription: true,
      subscription: subscription
    });

  } catch (error) {
    console.error('Error getting user subscription:', error);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

module.exports = router;