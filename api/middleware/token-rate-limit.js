const { createClient } = require('@supabase/supabase-js');

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
  const now = new Date();
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  try {
    // Check hourly limit
    const { data: hourlyData, error: hourlyError } = await supabase
      .from('token_rate_limits')
      .select('request_count')
      .eq('user_id', userId)
      .eq('action', action)
      .gte('window_start', hourStart.toISOString())
      .lt('window_start', new Date(hourStart.getTime() + 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (hourlyError) {
      console.error('Hourly rate limit check error:', hourlyError);
    }

    if (hourlyData && hourlyData.request_count >= LIMITS[action].hourly) {
      return {
        allowed: false,
        reason: 'HOURLY_LIMIT_EXCEEDED',
        limit: LIMITS[action].hourly,
        current: hourlyData.request_count,
        resetAt: new Date(hourStart.getTime() + 60 * 60 * 1000).toISOString()
      };
    }

    // Check daily limit
    const { data: dailyData, error: dailyError } = await supabase
      .from('token_rate_limits')
      .select('request_count')
      .eq('user_id', userId)
      .eq('action', action)
      .gte('window_start', dayStart.toISOString())
      .lt('window_start', new Date(dayStart.getTime() + 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (dailyError) {
      console.error('Daily rate limit check error:', dailyError);
    }

    if (dailyData && dailyData.request_count >= LIMITS[action].daily) {
      return {
        allowed: false,
        reason: 'DAILY_LIMIT_EXCEEDED',
        limit: LIMITS[action].daily,
        current: dailyData.request_count,
        resetAt: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000).toISOString()
      };
    }

    // Update or insert rate limit record
    const { error: incrementError } = await supabase.rpc('increment_token_rate_limit', {
      p_user_id: userId,
      p_action: action,
      p_window_start_hour: hourStart.toISOString(),
      p_window_start_day: dayStart.toISOString()
    });

    if (incrementError) {
      console.error('Failed to increment rate limit:', incrementError);
      // Allow request even if we couldn't increment
    }

    return { 
      allowed: true,
      remaining: {
        hourly: LIMITS[action].hourly - (hourlyData?.request_count || 0) - 1,
        daily: LIMITS[action].daily - (dailyData?.request_count || 0) - 1
      }
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the request but log it
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

    // Add rate limit headers
    if (result.remaining) {
      res.set({
        'X-RateLimit-Limit-Hourly': LIMITS[action].hourly.toString(),
        'X-RateLimit-Remaining-Hourly': Math.max(0, result.remaining.hourly).toString(),
        'X-RateLimit-Limit-Daily': LIMITS[action].daily.toString(),
        'X-RateLimit-Remaining-Daily': Math.max(0, result.remaining.daily).toString()
      });
    }

    next();
  };
}

module.exports = {
  tokenRateLimitMiddleware,
  checkTokenRateLimit,
  LIMITS
};