const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Rate limiting middleware
const rateLimitMiddleware = async (req, res, next) => {
  try {
    // Skip rate limiting for mock tokens or if user is not authenticated
    if (!req.auth || req.auth.clerkUserId.startsWith('mock_')) {
      return next();
    }

    const { userId } = req.auth;
    const endpoint = req.route?.path || req.path;
    
    // Default rate limits based on endpoint type
    let maxRequests = 100; // Default: 100 requests per hour
    let windowMinutes = 60; // 1 hour window

    // Adjust limits based on endpoint
    if (endpoint.includes('/usage/track')) {
      maxRequests = 1000; // Higher limit for usage tracking
      windowMinutes = 60;
    } else if (endpoint.includes('/analytics')) {
      maxRequests = 50; // Lower limit for analytics
      windowMinutes = 60;
    } else if (endpoint.includes('/credits/consume')) {
      maxRequests = 500; // Medium limit for credit operations
      windowMinutes = 60;
    }

    // Check rate limit using database function
    const { data: rateLimitResult, error } = await supabase.rpc('check_rate_limit', {
      p_user_id: userId,
      p_endpoint: endpoint,
      p_max_requests: maxRequests,
      p_window_minutes: windowMinutes
    });

    if (error) {
      console.error('Rate limit check error:', error);
      // On error, allow the request but log the error
      return next();
    }

    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        details: {
          currentCount: rateLimitResult.current_count,
          maxRequests: rateLimitResult.max_requests,
          resetAt: rateLimitResult.reset_at
        }
      });
    }

    // Add rate limit info to response headers
    res.set({
      'X-RateLimit-Limit': rateLimitResult.max_requests.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': new Date(rateLimitResult.reset_at || Date.now() + windowMinutes * 60 * 1000).toISOString()
    });

    next();
  } catch (error) {
    console.error('Rate limiting middleware error:', error);
    // On error, allow the request to proceed
    next();
  }
};

// Custom rate limiting function for specific endpoints
const customRateLimit = (maxRequests, windowMinutes) => {
  return async (req, res, next) => {
    try {
      if (!req.auth || req.auth.clerkUserId.startsWith('mock_')) {
        return next();
      }

      const { userId } = req.auth;
      const endpoint = req.route?.path || req.path;

      const { data: rateLimitResult, error } = await supabase.rpc('check_rate_limit', {
        p_user_id: userId,
        p_endpoint: endpoint,
        p_max_requests: maxRequests,
        p_window_minutes: windowMinutes
      });

      if (error) {
        console.error('Custom rate limit check error:', error);
        return next();
      }

      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          details: {
            currentCount: rateLimitResult.current_count,
            maxRequests: rateLimitResult.max_requests,
            resetAt: rateLimitResult.reset_at
          }
        });
      }

      res.set({
        'X-RateLimit-Limit': rateLimitResult.max_requests.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimitResult.reset_at || Date.now() + windowMinutes * 60 * 1000).toISOString()
      });

      next();
    } catch (error) {
      console.error('Custom rate limiting error:', error);
      next();
    }
  };
};

module.exports = {
  rateLimitMiddleware,
  customRateLimit
};