import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Rate limits configuration
const LIMITS = {
  generate: {
    hourly: 5,
    daily: 10
  },
  refresh: {
    hourly: 3,
    daily: 5
  }
};

/**
 * Check if user has exceeded rate limits
 * @param {string} userId - User ID
 * @param {string} action - Action type ('generate' or 'refresh')
 * @returns {Promise<Object>} Rate limit check result
 */
async function checkTokenRateLimit(userId, action = 'generate') {
  // For now, disable rate limiting to prevent errors
  // It will be enabled after the migration is run
  try {
    const now = new Date();
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    
    // Quick check if table exists
    const { error: tableCheckError } = await supabase
      .from('token_rate_limits')
      .select('id')
      .limit(1);

    if (tableCheckError) {
      if (tableCheckError.message?.includes('relation "token_rate_limits" does not exist')) {
        console.warn('⚠️ token_rate_limits table not found - rate limiting disabled until migration is run');
        return { allowed: true, warning: 'Rate limiting disabled - run migration' };
      }
    }

    // If table exists, do simple rate limiting
    const { count, error: countError } = await supabase
      .from('token_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('action', action)
      .gte('window_start', hourStart.toISOString());

    if (countError) {
      console.error('Rate limit count error:', countError);
      return { allowed: true }; // Allow on error
    }

    if (count >= LIMITS[action].hourly) {
      return {
        allowed: false,
        reason: 'HOURLY_LIMIT_EXCEEDED',
        limit: LIMITS[action].hourly,
        current: count,
        resetAt: new Date(hourStart.getTime() + 60 * 60 * 1000).toISOString()
      };
    }

    // Try to increment
    try {
      await supabase.rpc('increment_token_rate_limit', {
        p_user_id: userId,
        p_action: action,
        p_window_start_hour: hourStart.toISOString(),
        p_window_start_day: new Date(now.setHours(0, 0, 0, 0)).toISOString()
      });
    } catch (rpcError) {
      console.warn('Could not increment rate limit (function may not exist):', rpcError.message);
    }

    return {
      allowed: true,
      remaining: {
        hourly: LIMITS[action].hourly - (count || 0) - 1,
        daily: LIMITS[action].daily
      }
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true, error: error.message };
  }
}

/**
 * Express middleware for token rate limiting
 * @param {string} action - Action type ('generate' or 'refresh')
 * @returns {Function} Express middleware function
 */
function tokenRateLimitMiddleware(action = 'generate') {
  return async (req, res, next) => {
    // Skip rate limiting for development/mock users
    if (req.auth?.clerkUserId?.startsWith('mock_')) {
      return next();
    }

    if (!req.auth?.userId) {
      return res.status(401).json({ 
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const result = await checkTokenRateLimit(req.auth.userId, action);

    if (!result.allowed) {
      const period = result.reason.includes('HOURLY') ? 'hour' : 'day';
      const resetDate = new Date(result.resetAt);
      
      return res.status(429).json({
        error: result.reason,
        message: `Rate limit exceeded. Maximum ${result.limit} ${action} requests per ${period}.`,
        userMessage: `You've reached the maximum number of token ${action} requests (${result.limit} per ${period}). Please try again after ${resetDate.toLocaleTimeString()}.`,
        details: {
          limit: result.limit,
          current: result.current,
          resetAt: result.resetAt
        }
      });
    }

    // Add rate limit headers (Vercel uses setHeader, not set)
    if (result.remaining) {
      res.setHeader('X-RateLimit-Limit-Hourly', LIMITS[action].hourly.toString());
      res.setHeader('X-RateLimit-Remaining-Hourly', Math.max(0, result.remaining.hourly).toString());
      res.setHeader('X-RateLimit-Limit-Daily', LIMITS[action].daily.toString());
      res.setHeader('X-RateLimit-Remaining-Daily', Math.max(0, result.remaining.daily).toString());
    }

    next();
  };
}

export {
  tokenRateLimitMiddleware,
  checkTokenRateLimit,
  LIMITS
};