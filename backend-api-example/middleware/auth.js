const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to authenticate Clerk token
const authenticateClerkToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // For development/testing, allow mock tokens
    if (token.startsWith('mock_')) {
      req.auth = {
        clerkUserId: token.replace('mock_', ''),
        isAdmin: false
      };
      return next();
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!decoded.clerkUserId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    // Verify user exists in database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, clerk_id, plan_type')
      .eq('clerk_id', decoded.clerkUserId)
      .single();

    if (userError || !userData) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Add user info to request
    req.auth = {
      clerkUserId: decoded.clerkUserId,
      userId: userData.id,
      planType: userData.plan_type,
      isAdmin: userData.plan_type === 'admin' // Simple admin check
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Middleware to require admin access
const requireAdmin = (req, res, next) => {
  if (!req.auth || !req.auth.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = {
  authenticateClerkToken,
  requireAdmin
};