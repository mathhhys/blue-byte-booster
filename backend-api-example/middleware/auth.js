const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

console.log('middleware/auth.js: SUPABASE_URL:', process.env.SUPABASE_URL ? 'Loaded' : 'Not Loaded');
console.log('middleware/auth.js: SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Loaded' : 'Not Loaded');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('middleware/auth.js: JWT_SECRET:', process.env.JWT_SECRET ? 'Loaded' : 'Not Loaded');
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to authenticate Clerk token
const authenticateClerkToken = async (req, res, next) => {
  try {
    console.log('middleware/auth.js: authenticateClerkToken middleware hit');
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('middleware/auth.js: Missing or invalid authorization header');
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    console.log('middleware/auth.js: Authorization header found.');

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
      console.log('middleware/auth.js: JWT token verified. Decoded:', decoded);
    } catch (jwtError) {
      console.error('middleware/auth.js: JWT verification failed:', jwtError);
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (!decoded.clerkUserId) {
      console.error('middleware/auth.js: Invalid token payload: missing clerkUserId');
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    console.log('middleware/auth.js: Clerk User ID from token:', decoded.clerkUserId);

    // Verify user exists in database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, clerk_id, plan_type')
      .eq('clerk_id', decoded.clerkUserId)
      .single();

    if (userError || !userData) {
      console.error('middleware/auth.js: User not found in database. Error:', userError, 'UserData:', userData);
      return res.status(401).json({ error: 'User not found' });
    }
    console.log('middleware/auth.js: User found in database. UserData:', userData);

    // Add user info to request
    req.auth = {
      clerkUserId: decoded.clerkUserId,
      userId: userData.id,
      planType: userData.plan_type,
      isAdmin: userData.plan_type === 'admin' // Simple admin check
    };

    next();
  } catch (error) {
    console.error('middleware/auth.js: Auth middleware catch block error:', error);
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