// Example Express.js server for handling Stripe checkout sessions
// Deploy this separately or integrate with your backend framework
 
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const { Webhook } = require('svix'); // Import Svix
const { tokenMonitor } = require('./utils/token-monitoring');

console.log('server.js: Environment Variables Check:');
console.log('server.js: SUPABASE_URL:', process.env.SUPABASE_URL ? 'Loaded' : 'Not Loaded');
console.log('server.js: SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Loaded' : 'Not Loaded');
console.log('server.js: JWT_SECRET:', process.env.JWT_SECRET ? 'Loaded' : 'Not Loaded');
console.log('server.js: DATABASE_URL:', process.env.DATABASE_URL ? 'Loaded' : 'Not Loaded');
console.log('server.js: VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? 'Loaded' : 'Not Loaded');
console.log('server.js: VITE_APP_URL:', process.env.VITE_APP_URL ? 'Loaded' : 'Not Loaded');
console.log('server.js: FRONTEND_URL:', process.env.FRONTEND_URL ? 'Loaded' : 'Not Loaded');

// Import route modules
const vscodeRoutes = require('./routes/vscode');
const usersRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const dashboardTokenRoutes = require('./routes/dashboard-token');
const organizationsRoutes = require('./routes/organizations');

const app = express();
const port = process.env.PORT || 3001;

// PKCE Utility Functions
function generateRandomString(length) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

function sha256(plain) {
  return crypto.createHash('sha256').update(plain).digest();
}

function base64URLEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32)); // 43-128 characters
}

async function generateCodeChallenge(code_verifier) {
  const hashed = await sha256(code_verifier);
  return base64URLEncode(hashed);
}

// JWT Utility Functions
const JWT_SECRET = process.env.JWT_SECRET || generateRandomString(64); // Use a strong secret key
const ACCESS_TOKEN_EXPIRES_SECONDS = 60 * 60; // 1 hour in seconds
const REFRESH_TOKEN_EXPIRES_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds
const OAUTH_CODE_EXPIRES_SECONDS = 10 * 60; // 10 minutes in seconds

// Unified time calculation functions
function getCurrentEpochTime() {
  return Math.floor(Date.now() / 1000);
}

function calculateExpiryEpoch(durationSeconds) {
  return getCurrentEpochTime() + durationSeconds;
}

function epochToISOString(epochTime) {
  return new Date(epochTime * 1000).toISOString();
}

function logTokenTiming(tokenType, exp, expiresAtISO, clerkUserId = null) {
  const currentTime = getCurrentEpochTime();
  const serverTimeISO = new Date().toISOString();
  console.log(`server.js: ${tokenType} token timing:`, {
    currentServerEpoch: currentTime,
    currentServerUTC: serverTimeISO,
    tokenExpEpoch: exp,
    tokenExpiresAtISO: expiresAtISO,
    validitySeconds: exp - currentTime
  });
  
  // Add production monitoring
  if (clerkUserId) {
    tokenMonitor.logTokenGeneration(tokenType, clerkUserId, exp, expiresAtISO);
  }
}

function generateAccessToken(clerkUserId) {
  const exp = calculateExpiryEpoch(ACCESS_TOKEN_EXPIRES_SECONDS);
  const accessToken = jwt.sign({ clerkUserId, type: 'access', exp }, JWT_SECRET);
  
  const expiresAtISO = epochToISOString(exp);
  logTokenTiming('Access', exp, expiresAtISO, clerkUserId);
  
  return { token: accessToken, exp, expiresAtISO };
}

function generateRefreshToken(clerkUserId) {
  const exp = calculateExpiryEpoch(REFRESH_TOKEN_EXPIRES_SECONDS);
  const refreshToken = jwt.sign({ clerkUserId, type: 'refresh', exp }, JWT_SECRET);
  
  const expiresAtISO = epochToISOString(exp);
  logTokenTiming('Refresh', exp, expiresAtISO, clerkUserId);
  
  return { token: refreshToken, exp, expiresAtISO };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, { clockTolerance: 5 });
  } catch (error) {
    console.error('server.js: Token verification failed:', error.message);
    return null;
  }
}

// Supabase client for auth and real-time features
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for server-side operations
);

// PostgreSQL connection pool for direct database operations (Transaction Pooler)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
pool.on('connect', (client) => {
  console.log('✅ Connected to PostgreSQL database via transaction pooler');
  client.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('❌ Error testing database connection:', err.message);
    } else {
      console.log('📊 Database connection test successful. Current DB time:', res.rows[0].now);
    }
  });
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
});

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'https://www.softcodes.ai', // Default to production URL
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204 // For preflight requests
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable preflight for all routes

// For Stripe and Clerk webhooks, we need the raw body before JSON parsing
app.use('/api/stripe/webhooks', express.raw({ type: 'application/json' }));
app.use('/api/clerk/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json());

// Add a middleware for logging incoming requests to debug CORS
app.use((req, res, next) => {
  console.log('=== CORS DEBUG: Incoming Request ===');
  console.log('Method:', req.method);
  console.log('URL:', req.originalUrl);
  console.log('Origin Header:', req.headers.origin);
  console.log('CORS Options Origin:', corsOptions.origin);
  console.log('FRONTEND_URL env:', process.env.FRONTEND_URL);
  console.log('All CORS headers:');
  console.log('  - Access-Control-Request-Method:', req.headers['access-control-request-method']);
  console.log('  - Access-Control-Request-Headers:', req.headers['access-control-request-headers']);
  
  // Check if origin matches CORS policy
  const originMatches = req.headers.origin === corsOptions.origin;
  console.log('Origin matches CORS policy:', originMatches);
  
  if (req.method === 'OPTIONS') {
    console.log('This is a preflight request');
    // Add temporary response logging for preflight
    const originalSend = res.send;
    res.send = function(data) {
      console.log('Preflight response headers:', res.getHeaders());
      return originalSend.call(this, data);
    };
  }
  console.log('=====================================');
  next();
});
// Register API routes
app.use('/api/vscode', vscodeRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard-token', dashboardTokenRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/extension/auth', extensionAuthRoutes);
app.use('/api/user', userRoutes);

// Create Stripe checkout session
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { planType, billingFrequency, seats = 1, clerkUserId, successUrl, cancelUrl } = req.body;

    // Validate input
    if (!planType || !billingFrequency || !clerkUserId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get price ID based on plan and billing frequency
    const priceIds = {
      pro: {
        monthly: 'price_1RvKJcH6gWxKcaTXQ4PITKei',
        yearly: 'price_1RvKJtH6gWxKcaTXfeLXklqU',
      },
      teams: {
        monthly: 'price_teams_monthly', // You need to create this in Stripe
        yearly: 'price_teams_yearly',   // You need to create this in Stripe
      },
    };

    const priceId = priceIds[planType]?.[billingFrequency];
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan or billing frequency' });
    }

    // Create or get Stripe customer
    let customer;
    try {
      // Try to find existing customer by Clerk user ID
      const customers = await stripe.customers.list({
        limit: 100, // Search through customers to find by metadata
      });

      // Find customer with matching clerk_user_id in metadata
      customer = customers.data.find(c => c.metadata?.clerk_user_id === clerkUserId);

      if (!customer) {
        // Optionally fetch email from Supabase if not passed in body
        let customerEmail = req.body.email;
        if (!customerEmail) {
          const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('email')
            .eq('clerk_id', clerkUserId)
            .single();
          if (!fetchError && userData?.email) {
            customerEmail = userData.email;
          }
        }

        // Create new customer with email and metadata
        customer = await stripe.customers.create({
          email: customerEmail || undefined,
          description: `Customer for Clerk user ${clerkUserId}`
        });
      }
    } catch (error) {
      console.error('Error creating/finding customer:', error);
      return res.status(500).json({ error: 'Failed to create customer' });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: seats,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        clerk_user_id: clerkUserId,
        plan_type: planType,
        billing_frequency: billingFrequency,
        seats: seats.toString(),
      },
      subscription_data: {
        metadata: {
          clerk_user_id: clerkUserId,
          plan_type: planType,
          billing_frequency: billingFrequency,
          seats: seats.toString(),
        },
      },
    });

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Get checkout session status
app.get('/api/stripe/session-status', async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Handle mock sessions for development
    if (session_id.startsWith('cs_mock_')) {
      return res.status(404).json({
        success: false,
        error: 'Mock session - use frontend mock implementation'
      });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription'],
    });

    // Get metadata from session first, then from subscription if available
    const metadata = session.metadata || {};
    if (session.subscription && session.subscription.metadata) {
      Object.assign(metadata, session.subscription.metadata);
    }

    res.json({
      success: true,
      data: {
        status: session.status,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency,
        customer_email: session.customer_details?.email,
        subscription_id: session.subscription?.id,
        metadata: metadata,
      },
    });
  } catch (error) {
    console.error('Error retrieving session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session status'
    });
  }
});

// Process payment success (called from frontend after successful payment)
app.post('/api/stripe/process-payment-success', async (req, res) => {
  try {
    const { sessionId, clerkUserId } = req.body;

    if (!sessionId || !clerkUserId) {
      return res.status(400).json({ error: 'Session ID and Clerk User ID are required' });
    }

    // Handle mock sessions for development
    let session;
    if (sessionId.startsWith('cs_mock_')) {
      // Create mock session data for development
      session = {
        id: sessionId,
        status: 'complete',
        payment_status: 'paid',
        amount_total: 2000, // $20.00 in cents
        currency: 'usd',
        customer_details: {
          email: 'demo@example.com'
        },
        subscription: {
          id: `sub_mock_${Date.now()}`
        },
        metadata: {
          plan_type: 'pro',
          billing_frequency: 'monthly',
          seats: '1'
        }
      };
    } else {
      // Get real session details from Stripe
      try {
        session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['subscription'],
        });
      } catch (stripeError) {
        console.error('Error retrieving Stripe session:', stripeError);
        return res.status(400).json({ error: 'Invalid session ID' });
      }
    }

    // Extract metadata
    const metadata = session.metadata || {};
    if (session.subscription && session.subscription.metadata) {
      Object.assign(metadata, session.subscription.metadata);
    }

    const { plan_type, billing_frequency, seats = 1 } = metadata;

    if (!plan_type || !billing_frequency) {
      return res.status(400).json({ error: 'Missing payment metadata' });
    }

    // Check if user exists, create if not
    let user;
    try {
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', clerkUserId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw fetchError;
      }

      if (!existingUser) {
        // Create user if doesn't exist
        const { data: newUser, error: createError } = await supabase.rpc('upsert_user', {
          p_clerk_id: clerkUserId,
          p_email: session.customer_details?.email || 'unknown@example.com',
          p_plan_type: plan_type
        });

        if (createError) throw createError;

        // Fetch the created user
        const { data: createdUser, error: fetchNewError } = await supabase
          .from('users')
          .select('id')
          .eq('id', newUser)
          .single();

        if (fetchNewError) throw fetchNewError;
        user = createdUser;
      } else {
        user = existingUser;
      }
    } catch (error) {
      console.error('Error handling user:', error);
      return res.status(500).json({ error: 'Failed to process user' });
    }

    // Update user plan
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ plan_type, updated_at: new Date().toISOString() })
        .eq('clerk_id', clerkUserId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error updating user plan:', error);
      return res.status(500).json({ error: 'Failed to update user plan' });
    }

    // Create subscription record
    try {
      const { error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          stripe_subscription_id: session.subscription,
          plan_type,
          billing_frequency,
          seats: parseInt(seats) || 1,
          status: 'active',
        });

      if (subError) throw subError;
    } catch (error) {
      console.error('Error creating subscription:', error);
      return res.status(500).json({ error: 'Failed to create subscription' });
    }

    // Grant credits
    try {
      const creditsPerSeat = 500;
      const totalCredits = creditsPerSeat * (parseInt(seats) || 1);
      
      const { error: creditError } = await supabase.rpc('grant_credits', {
        p_clerk_id: clerkUserId,
        p_amount: totalCredits,
        p_description: `${plan_type} plan credits (${seats || 1} seat${(seats || 1) > 1 ? 's' : ''})`,
        p_reference_id: session.subscription,
      });

      if (creditError) throw creditError;
    } catch (error) {
      console.error('Error granting credits:', error);
      return res.status(500).json({ error: 'Failed to grant credits' });
    }

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        planType: plan_type,
        billingFrequency: billing_frequency,
        seats: parseInt(seats) || 1,
        creditsGranted: 500 * (parseInt(seats) || 1)
      }
    });

  } catch (error) {
    console.error('Error processing payment success:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Process starter plan signup (no payment required)
app.post('/api/starter/process-signup', async (req, res) => {
  try {
    const { clerkUserId, email, firstName, lastName } = req.body;

    if (!clerkUserId) {
      return res.status(400).json({ error: 'Clerk User ID is required' });
    }

    // Check if user already exists
    let user;
    try {
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, plan_type, credits')
        .eq('clerk_id', clerkUserId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw fetchError;
      }

      if (existingUser) {
        // User already exists, just return success
        return res.json({
          success: true,
          message: 'User already exists',
          data: {
            planType: existingUser.plan_type,
            credits: existingUser.credits,
            isExisting: true
          }
        });
      }

      // Create new user with starter plan
      const { data: newUserId, error: createError } = await supabase.rpc('upsert_user', {
        p_clerk_id: clerkUserId,
        p_email: email || 'unknown@example.com',
        p_first_name: firstName || null,
        p_last_name: lastName || null,
        p_plan_type: 'starter'
      });

      if (createError) throw createError;

      // Fetch the created user to verify credits
      const { data: createdUser, error: fetchNewError } = await supabase
        .from('users')
        .select('id, plan_type, credits')
        .eq('id', newUserId)
        .single();

      if (fetchNewError) throw fetchNewError;
      user = createdUser;

      // Ensure user has exactly 25 credits (backup check in case upsert_user didn't set them correctly)
      if (user.credits !== 25) {
        console.log(`User ${clerkUserId} has ${user.credits} credits, adjusting to 25`);
        
        const creditAdjustment = 25 - user.credits;
        const { error: creditError } = await supabase.rpc('grant_credits', {
          p_clerk_id: clerkUserId,
          p_amount: creditAdjustment,
          p_description: 'Starter plan credits adjustment',
          p_reference_id: null
        });

        if (creditError) {
          console.error('Error adjusting credits:', creditError);
          // Don't fail the request, just log the error
        } else {
          user.credits = 25;
        }
      }

    } catch (error) {
      console.error('Error handling user:', error);
      return res.status(500).json({ error: 'Failed to process user' });
    }

    res.json({
      success: true,
      message: 'Starter plan activated successfully',
      data: {
        planType: 'starter',
        credits: 25, // Always return 25 for starter plan
        isExisting: false
      }
    });

  } catch (error) {
    console.error('Error processing starter signup:', error);
    res.status(500).json({ error: 'Failed to process starter signup' });
  }
});
// Initiate VSCode authentication flow
app.get('/api/auth/initiate-vscode-auth', async (req, res) => {
  try {
    const { redirect_uri } = req.query;

    if (!redirect_uri) {
      return res.status(400).json({ error: 'Missing redirect_uri parameter' });
    }

    const code_verifier = generateCodeVerifier();
    const code_challenge = await generateCodeChallenge(code_verifier);
    const state = generateRandomString(32); // Generate a random state for CSRF protection

    // Store the code_verifier, code_challenge, state, and redirect_uri in the database
    const oauthExp = calculateExpiryEpoch(OAUTH_CODE_EXPIRES_SECONDS);
    const oauthExpiresAt = epochToISOString(oauthExp);
    
    console.log('OAuth Code Creation: Code timing:', {
      currentEpoch: getCurrentEpochTime(),
      oauthExpEpoch: oauthExp,
      oauthExpiresAtISO: oauthExpiresAt,
      validityMinutes: OAUTH_CODE_EXPIRES_SECONDS / 60
    });

    const { data, error } = await supabase
      .from('oauth_codes')
      .insert([
        {
          clerk_user_id: 'pending', // Will be updated after Clerk auth
          code_verifier,
          code_challenge,
          state,
          redirect_uri,
          expires_at: oauthExpiresAt,
        },
      ])
      .select();

    if (error) {
      console.error('Error storing OAuth code:', error);
      return res.status(500).json({ error: 'Failed to initiate authentication' });
    }

    // Build the absolute URL for Clerk authentication
    const baseUrl = process.env.FRONTEND_URL || 'https://softcodes.ai';
    
    // Encode the callback URL properly
    const callbackUrl = `/auth/vscode-callback?state=${state}&vscode_redirect_uri=${encodeURIComponent(redirect_uri)}`;
    const authUrl = `${baseUrl}/sign-in?redirect_url=${encodeURIComponent(callbackUrl)}`;
    
    console.log('VSCode Auth Initiate: Generated code_verifier:', code_verifier);
    console.log('VSCode Auth Initiate: Generated code_challenge:', code_challenge);
    console.log('VSCode Auth Initiate: Generated state:', state);
    console.log('VSCode Auth Initiate: Generated auth_url:', authUrl);

    res.json({
      success: true,
      code_challenge,
      state,
      auth_url: authUrl, // Now returns absolute URL
    });

  } catch (error) {
    console.error('Error initiating VSCode authentication:', error);
    res.status(500).json({ error: 'Failed to initiate VSCode authentication' });
  }
});

// Exchange authorization code for tokens
app.post('/api/auth/token', async (req, res) => {
  try {
    const { code, code_verifier, state, redirect_uri } = req.body;

    if (!code || !code_verifier || !state || !redirect_uri) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // 1. Retrieve and validate the stored OAuth code by authorization_code AND state
    const { data: oauthCode, error: fetchError } = await supabase
      .from('oauth_codes')
      .select('*')
      .eq('authorization_code', code) // Use authorization_code field
      .eq('state', state)
      .single();

    if (fetchError || !oauthCode || new Date(oauthCode.expires_at) < new Date()) {
      console.error('Invalid or expired authorization code:', code, fetchError);
      return res.status(400).json({ error: 'Invalid or expired authorization code' });
    }

    // 2. Verify code_challenge
    const expectedCodeChallenge = await generateCodeChallenge(code_verifier);
    if (oauthCode.code_challenge !== expectedCodeChallenge) {
      console.error('Code challenge mismatch for state:', state);
      return res.status(400).json({ error: 'Invalid code verifier' });
    }

    // 3. Verify redirect_uri
    if (oauthCode.redirect_uri !== redirect_uri) {
      console.error('Redirect URI mismatch for state:', state);
      return res.status(400).json({ error: 'Invalid redirect URI' });
    }

    // 4. Get the Clerk user ID from the OAuth record
    const clerkUserId = oauthCode.clerk_user_id;
    console.log('VSCode Auth Token: Using Clerk User ID from OAuth record:', clerkUserId);

    // 5. Generate access and refresh tokens
    const accessTokenData = generateAccessToken(clerkUserId);
    const refreshTokenData = generateRefreshToken(clerkUserId);
    console.log('VSCode Auth Token: Generated Access Token:', accessTokenData.token);
    console.log('VSCode Auth Token: Generated Refresh Token:', refreshTokenData.token);

    // 6. Store refresh token in the database
    const { error: refreshError } = await supabase
      .from('refresh_tokens')
      .insert([
        {
          clerk_user_id: clerkUserId,
          token: refreshTokenData.token,
          expires_at: refreshTokenData.expiresAtISO,
        },
      ]);

    if (refreshError) {
      console.error('Error storing refresh token:', refreshError);
      return res.status(500).json({ error: 'Failed to issue tokens' });
    }

    // 7. Delete the used oauth_code
    await supabase.from('oauth_codes').delete().eq('id', oauthCode.id);

    res.json({
      success: true,
      access_token: accessTokenData.token,
      refresh_token: refreshTokenData.token,
      expires_in: ACCESS_TOKEN_EXPIRES_SECONDS,
    });

  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    res.status(500).json({ error: 'Failed to exchange code for tokens' });
  }
});

// Refresh access token using refresh token
app.post('/api/auth/refresh-token', async (req, res) => {
  try {
    const { refresh_token: oldRefreshToken } = req.body;

    if (!oldRefreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // 1. Verify the refresh token's signature
    const decoded = verifyToken(oldRefreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const { clerkUserId } = decoded;

    // 2. Check if the refresh token exists in the database and is not revoked/expired
    const { data: storedRefreshToken, error: fetchError } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token', oldRefreshToken)
      .eq('clerk_user_id', clerkUserId)
      .is('revoked_at', null)
      .single();

    if (fetchError || !storedRefreshToken || new Date(storedRefreshToken.expires_at) < new Date()) {
      // If token is invalid, revoked, or expired, revoke all tokens for this user for security
      await supabase
        .from('refresh_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('clerk_user_id', clerkUserId)
        .is('revoked_at', null); // Only revoke active tokens
      
      console.error('Invalid, revoked, or expired refresh token for user:', clerkUserId, fetchError);
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // 3. Revoke the old refresh token (one-time use)
    await supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', storedRefreshToken.id);

    // 4. Generate new access and refresh tokens
    const newAccessTokenData = generateAccessToken(clerkUserId);
    const newRefreshTokenData = generateRefreshToken(clerkUserId);

    // 5. Store the new refresh token in the database
    const { error: insertError } = await supabase
      .from('refresh_tokens')
      .insert([
        {
          clerk_user_id: clerkUserId,
          token: newRefreshTokenData.token,
          expires_at: newRefreshTokenData.expiresAtISO,
        },
      ]);

    if (insertError) {
      console.error('Error storing new refresh token:', insertError);
      return res.status(500).json({ error: 'Failed to issue new tokens' });
    }

    console.log('VSCode Auth Refresh Token: Clerk User ID:', clerkUserId);
    console.log('VSCode Auth Refresh Token: Generated New Access Token:', newAccessTokenData.token);
    console.log('VSCode Auth Refresh Token: Generated New Refresh Token:', newRefreshTokenData.token);

    res.json({
      success: true,
      access_token: newAccessTokenData.token,
      refresh_token: newRefreshTokenData.token,
      expires_in: ACCESS_TOKEN_EXPIRES_SECONDS,
    });

  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Clerk webhook handler for user creation
app.post('/api/clerk/webhooks', async (req, res) => {
  const CLERK_WEBHOOK_SIGNING_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  if (!CLERK_WEBHOOK_SIGNING_SECRET) {
    console.error('CLERK_WEBHOOK_SIGNING_SECRET is not set in environment variables.');
    return res.status(500).json({ error: 'Webhook secret not configured.' });
  }

  const payload = req.body;
  const headers = req.headers;


  const svix_id = headers['svix-id'];
  const svix_timestamp = headers['svix-timestamp'];
  const svix_signature = headers['svix-signature'];

  // If there are no Svix headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: 'No Svix headers found.' });
  }

  // Create a new Webhook instance with your Clerk webhook secret
  const wh = new Webhook(CLERK_WEBHOOK_SIGNING_SECRET);

  let evt;
  try {
    // Verify the webhook payload
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return res.status(400).json({ error: 'Webhook verification failed.' });
  }

  const eventType = evt.type;
  console.log(`Received Clerk webhook with ID ${evt.data.id} and event type of ${eventType}`);
  console.log('Webhook payload:', evt.data);

  try {
    if (eventType === 'user.created' || eventType === 'user.updated') {
      const user = evt.data;
      
      // Handle email addresses with graceful fallbacks
      let primaryEmailAddress = null;
      
      // Try to find primary email by ID first
      if (user.email_addresses && user.email_addresses.length > 0) {
        primaryEmailAddress = user.email_addresses.find(
          (email) => email.id === user.primary_email_address_id
        )?.email_address || user.email_addresses[0]?.email_address;
      }
      
      // If no email found but user has primary_email_address_id, use a placeholder
      if (!primaryEmailAddress) {
        if (user.primary_email_address_id) {
          // Use a placeholder email format for users without accessible email data
          primaryEmailAddress = `user_${user.id.replace('user_', '')}@clerk.placeholder`;
          console.warn(`No email addresses available for user ${user.id}, using placeholder: ${primaryEmailAddress}`);
        } else {
          // Fallback to a generic placeholder
          primaryEmailAddress = `${user.id}@clerk.placeholder`;
          console.warn(`No email data found for user ${user.id}, using generic placeholder: ${primaryEmailAddress}`);
        }
      }

      const { data, error } = await supabase.rpc('upsert_user', {
        p_clerk_id: user.id,
        p_email: primaryEmailAddress,
        p_first_name: user.first_name || null,
        p_last_name: user.last_name || null,
        p_avatar_url: user.image_url || user.profile_image_url || null,
        p_plan_type: 'starter' // Default to starter, update later if needed
      });

      if (error) {
        console.error('Error upserting user from webhook:', error);
        return res.status(500).json({ error: 'Failed to upsert user.' });
      }
      console.log(`Successfully upserted user ${user.id} from webhook with email: ${primaryEmailAddress}`);

    } else if (eventType === 'user.deleted') {
      const user = evt.data;
      if (!user.id) {
        console.error('User ID not found in user.deleted webhook payload');
        return res.status(400).json({ error: 'User ID not found in payload.' });
      }

      // In a real application, you might want to soft-delete the user
      // or remove sensitive information. For this example, we'll log.
      console.log(`User with Clerk ID ${user.id} marked for deletion.`);
      // Example: await supabase.from('users').update({ deleted: true }).eq('clerk_id', user.id);
      // Or delete: await supabase.from('users').delete().eq('clerk_id', user.id);

    } else {
      console.log(`Unhandled Clerk webhook event type: ${eventType}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing Clerk webhook event:', error);
    res.status(500).json({ error: 'Webhook event processing failed.' });
  }
});

// Stripe webhook handler
app.post('/api/stripe/webhooks', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Webhook event handlers
async function handleCheckoutSessionCompleted(session) {
  const { clerk_user_id, clerk_org_id, plan_type, billing_frequency, seats, seats_total, type } = session.metadata || {};

  try {
    if (type === 'organization') {
      // Handle organization subscription
      if (!clerk_org_id || !plan_type || !billing_frequency || !seats_total) {
        console.error('Missing required metadata for organization checkout:', session.metadata);
        return;
      }

      console.log('Processing organization checkout for:', clerk_org_id);

      // Ensure organization exists
      const { data: orgId, error: orgError } = await supabase.rpc('upsert_organization', {
        p_clerk_org_id: clerk_org_id,
        p_stripe_customer_id: session.customer
      });

      if (orgError) {
        console.error('Error upserting organization:', orgError);
        return;
      }

      // Create organization subscription record
      const { error: subError } = await supabase
        .from('organization_subscriptions')
        .insert({
          organization_id: orgId,
          clerk_org_id: clerk_org_id,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          plan_type,
          billing_frequency,
          seats_total: parseInt(seats_total),
          seats_used: 0,
          status: 'active',
          current_period_start: new Date(session.subscription.current_period_start * 1000),
          current_period_end: new Date(session.subscription.current_period_end * 1000)
        });

      if (subError) {
        console.error('Error creating organization subscription:', subError);
        return;
      }

      console.log(`Successfully processed organization checkout for ${clerk_org_id}`);

    } else {
      // Handle individual user subscription
      if (!clerk_user_id || !plan_type || !billing_frequency) {
        console.error('Missing required metadata for individual checkout:', session.metadata);
        return;
      }

      console.log('Processing individual checkout for:', clerk_user_id);

      // Get user first
      const { data: userData, error: userFetchError } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', clerk_user_id)
        .single();

      if (userFetchError || !userData) {
        console.error('User not found for clerk_id:', clerk_user_id);
        return;
      }

      // Update user plan in Supabase
      const { error: userError } = await supabase
        .from('users')
        .update({ plan_type, stripe_customer_id: session.customer })
        .eq('clerk_id', clerk_user_id);

      if (userError) throw userError;

      // Create subscription record
      const { error: subError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userData.id,
          stripe_subscription_id: session.subscription,
          plan_type,
          billing_frequency,
          seats: parseInt(seats) || 1,
          status: 'active',
          current_period_start: new Date(session.subscription.current_period_start * 1000),
          current_period_end: new Date(session.subscription.current_period_end * 1000)
        });

      if (subError) throw subError;

      // Grant credits
      const creditsPerSeat = 500;
      const totalCredits = creditsPerSeat * (parseInt(seats) || 1);

      const { error: creditError } = await supabase.rpc('grant_credits', {
        p_clerk_id: clerk_user_id,
        p_amount: totalCredits,
        p_description: `${plan_type} plan credits (${seats || 1} seat${(seats || 1) > 1 ? 's' : ''})`,
        p_reference_id: session.subscription,
      });

      if (creditError) throw creditError;

      console.log(`Successfully processed individual checkout for user ${clerk_user_id}`);
    }
  } catch (error) {
    console.error('Error processing checkout completion:', error);
  }
}

async function handlePaymentSucceeded(invoice) {
  console.log('Payment succeeded:', invoice.id);
  // Handle recurring payment success
}

async function handlePaymentFailed(invoice) {
  console.log('Payment failed:', invoice.id);
  // Handle payment failure
}

async function handleSubscriptionUpdated(subscription) {
  console.log('Subscription updated:', subscription.id);

  try {
    const metadata = subscription.metadata || {};

    if (metadata.type === 'organization') {
      // Update organization subscription
      const { error } = await supabase
        .from('organization_subscriptions')
        .update({
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
          updated_at: new Date()
        })
        .eq('stripe_subscription_id', subscription.id);

      if (error) {
        console.error('Error updating organization subscription:', error);
      }
    } else {
      // Update individual subscription
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
          updated_at: new Date()
        })
        .eq('stripe_subscription_id', subscription.id);

      if (error) {
        console.error('Error updating individual subscription:', error);
      }
    }
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  console.log('Subscription deleted:', subscription.id);

  try {
    const metadata = subscription.metadata || {};

    if (metadata.type === 'organization') {
      // Mark organization subscription as canceled
      const { error } = await supabase
        .from('organization_subscriptions')
        .update({
          status: 'canceled',
          updated_at: new Date()
        })
        .eq('stripe_subscription_id', subscription.id);

      if (error) {
        console.error('Error canceling organization subscription:', error);
      }
    } else {
      // Mark individual subscription as canceled
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
          updated_at: new Date()
        })
        .eq('stripe_subscription_id', subscription.id);

      if (error) {
        console.error('Error canceling individual subscription:', error);
      }
    }
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
}


// Start server (only if not being imported as a module)
if (require.main === module) {
  app.listen(port, () => {
    console.log(`server.js: Server running on port ${port}`);
    
    // Start token monitoring system
    tokenMonitor.startPeriodicMonitoring(15); // Monitor every 15 minutes
  });
}

module.exports = app;