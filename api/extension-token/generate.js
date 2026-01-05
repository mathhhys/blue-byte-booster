import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { verifyToken, createClerkClient } from '@clerk/backend';
import { encryptData } from '../utils/encryption.js';
import { tokenRateLimitMiddleware } from '../middleware/token-rate-limit.js';
import { logTokenAudit } from '../middleware/token-validation.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LONG_LIVED_EXPIRES_SECONDS = 4 * 30 * 24 * 60 * 60; // 4 months in seconds
const BCRYPT_SALT_ROUNDS = 12;
const MAX_TOKENS_PER_USER = 5; // Maximum number of active tokens per user

let cachedClerkClient = null;

function getClerkClient() {
  if (!cachedClerkClient) {
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error('Missing CLERK_SECRET_KEY environment variable');
    }
    cachedClerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  }
  return cachedClerkClient;
}

// Helper functions for time
function getCurrentEpochTime() {
  return Math.floor(Date.now() / 1000);
}

function epochToISOString(epochTime) {
  return new Date(epochTime * 1000).toISOString();
}

// Verify Clerk token
async function verifyClerkToken(token) {
  try {
    if (!process.env.CLERK_SECRET_KEY) {
      throw new Error('Missing CLERK_SECRET_KEY environment variable');
    }

    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });

    if (!claims.sub) {
      throw new Error('Invalid Clerk token: missing user ID');
    }

    return {
      clerkUserId: claims.sub,
      sessionId: claims.sid,
      exp: claims.exp,
      email: claims.email,
      claims
    };
  } catch (error) {
    throw new Error('Invalid Clerk token: ' + error.message);
  }
}

/**
 * Best-effort org membership check (claims-first; Clerk API fallback).
 * Returns { orgRole } if membership is confirmed, otherwise null.
 */
async function resolveOrgMembership(clerkUserId, clerkOrgId, claims) {
  if (!clerkOrgId) {
    return null;
  }

  const orgsFromClaims = (claims?.organizations || {});
  const orgFromClaims = orgsFromClaims?.[clerkOrgId];

  if (orgFromClaims) {
    return { orgRole: orgFromClaims?.role || 'org:member', source: 'claims' };
  }

  // Fallback to Clerk API
  try {
    const membershipsResponse = await getClerkClient().users.getOrganizationMembershipList({
      userId: clerkUserId,
      limit: 100
    });

    const memberships = Array.isArray(membershipsResponse?.data) ? membershipsResponse.data : [];
    const apiMembership = memberships.find((m) => {
      const candidateOrgId = m?.organization?.id ?? m?.organizationId ?? m?.organizationID;
      return candidateOrgId === clerkOrgId;
    });

    if (apiMembership) {
      return { orgRole: apiMembership?.role || 'org:member', source: 'api' };
    }
  } catch (apiError) {
    console.error('Clerk API membership lookup failed:', apiError);
  }

  return null;
}

/**
 * Resolve org attribution claims for a token (seat-gated).
 * - If the user is not a member or has no active seat, returns null (personal token).
 */
async function resolveOrgAttributionClaims(clerkUserId, clerkOrgId, claims) {
  if (!clerkOrgId) {
    return null;
  }

  const membership = await resolveOrgMembership(clerkUserId, clerkOrgId, claims);
  if (!membership) {
    return null;
  }

  // Seat-gating: only active seat holders receive org-scoped tokens
  const { data: seat, error: seatError } = await supabase
    .from('organization_seats')
    .select('id, role, organization_subscription_id')
    .eq('clerk_org_id', clerkOrgId)
    .eq('clerk_user_id', clerkUserId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (seatError) {
    console.error('Error fetching active seat:', seatError);
    return null;
  }

  if (!seat) {
    return null;
  }

  const [{ data: organization }, { data: subscription, error: subError }] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, stripe_customer_id')
      .eq('clerk_org_id', clerkOrgId)
      .maybeSingle(),
    supabase
      .from('organization_subscriptions')
      .select('id, organization_id')
      .eq('id', seat.organization_subscription_id)
      .in('status', ['active', 'trialing'])
      .maybeSingle()
  ]);

  if (subError) {
    console.error('Error fetching organization subscription:', subError);
  }

  return {
    pool: 'organization',
    clerk_org_id: clerkOrgId,
    organization_id: organization?.id || subscription?.organization_id || null,
    organization_name: organization?.name || null,
    stripe_customer_id: organization?.stripe_customer_id || null,
    organization_subscription_id: subscription?.id || seat.organization_subscription_id || null,
    seat_id: seat.id,
    seat_role: seat.role || null,
    org_role: membership.orgRole || 'org:member'
  };
}

// Generate long-lived token
async function generateLongLivedToken(clerkUserId, deviceName, ipAddress, userAgent, orgAttribution = null) {
  // Fetch user ID
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', clerkUserId)
    .single();

  if (userError || !userData) {
    throw new Error('User not found in database');
  }

  const userId = userData.id;

  // Check number of active tokens
  const { count: activeTokenCount, error: countError } = await supabase
    .from('extension_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gte('expires_at', new Date().toISOString());

  if (countError) {
    console.error('Error checking token count:', countError);
  }

  if ((activeTokenCount || 0) >= MAX_TOKENS_PER_USER) {
    throw new Error(`Maximum of ${MAX_TOKENS_PER_USER} active tokens allowed. Please revoke an existing token first.`);
  }

  // Generate JWT
  const iat = getCurrentEpochTime();
  const exp = iat + LONG_LIVED_EXPIRES_SECONDS;

  if (!process.env.JWT_SECRET) {
    throw new Error('Missing JWT_SECRET environment variable');
  }

  const payload = {
    sub: clerkUserId,
    type: 'extension_long_lived',
    iat,
    exp,
    iss: 'softcodes.ai',
    aud: 'vscode-extension',

    // Org attribution (seat-gated). If absent => personal.
    pool: orgAttribution?.pool === 'organization' ? 'organization' : 'personal',
    clerk_org_id: orgAttribution?.clerk_org_id || null,
    organization_id: orgAttribution?.organization_id || null,
    organization_name: orgAttribution?.organization_name || null,
    stripe_customer_id: orgAttribution?.stripe_customer_id || null,
    organization_subscription_id: orgAttribution?.organization_subscription_id || null,
    seat_id: orgAttribution?.seat_id || null,
    seat_role: orgAttribution?.seat_role || null,
    org_role: orgAttribution?.org_role || null
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256' });

  // Hash token
  const tokenHash = await bcrypt.hash(token, BCRYPT_SALT_ROUNDS);

  // Expires at ISO
  const expiresAtISO = epochToISOString(exp);

  // Encrypt sensitive metadata
  let deviceInfoEncrypted = null;
  let ipAddressEncrypted = null;

  try {
    if (userAgent) {
      deviceInfoEncrypted = encryptData(userAgent);
    }
    if (ipAddress) {
      ipAddressEncrypted = encryptData(ipAddress);
    }
  } catch (encryptError) {
    console.error('Failed to encrypt metadata:', encryptError);
    // Continue without encryption rather than failing
  }

  // Insert into extension_tokens
  // Try with new columns first, fallback to basic if migration not run
  let newToken;
  let insertData = {
    user_id: userId,
    token_hash: tokenHash,
    name: 'VSCode Long-Lived Token',
    expires_at: expiresAtISO
  };

  // Try to add new columns if they exist
  try {
    insertData = {
      ...insertData,
      device_name: deviceName || 'VSCode Extension',
      device_info_encrypted: deviceInfoEncrypted,
      ip_address_encrypted: ipAddressEncrypted
    };

    const { data, error: insertError } = await supabase
      .from('extension_tokens')
      .insert(insertData)
      .select('id')
      .single();

    if (insertError) {
      // If column doesn't exist, try basic insert
      if (insertError.message?.includes('column') && insertError.message?.includes('does not exist')) {
        console.warn('⚠️ New columns not found - using basic insert. Run migration for enhanced features.');
        const { data: basicData, error: basicError } = await supabase
          .from('extension_tokens')
          .insert({
            user_id: userId,
            token_hash: tokenHash,
            name: 'VSCode Long-Lived Token',
            expires_at: expiresAtISO
          })
          .select('id')
          .single();

        if (basicError) {
          throw basicError;
        }
        newToken = basicData;
      } else {
        throw insertError;
      }
    } else {
      newToken = data;
    }
  } catch (error) {
    console.error('Token insert error:', error);
    throw new Error('Failed to store token');
  }

  // Log audit event (gracefully handles missing table)
  await logTokenAudit({
    tokenId: newToken.id,
    userId: userId,
    action: 'generated',
    details: {
      device_name: deviceName || 'VSCode Extension',
      expires_at: expiresAtISO
    },
    ipAddress: ipAddress,
    userAgent: userAgent
  });

  // Log
  console.log(
    `Long-lived token generated for user ${clerkUserId} (ID: ${userId}), device: ${deviceName}, pool: ${orgAttribution?.pool || 'personal'}, expires at ${expiresAtISO}`
  );

  return { token, exp, expiresAtISO, tokenId: newToken.id };
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'MISSING_AUTH_HEADER',
        message: 'Missing or invalid authorization header',
        userMessage: 'Authentication required. Please sign in again.'
      });
    }

    const token = authHeader.substring(7);
    const { deviceName, clerk_org_id: clerkOrgId } = req.body || {};
    const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // For development/testing, allow mock tokens
    if (token.startsWith('mock_') || token.startsWith('clerk_mock_')) {
      const clerkUserId = token.replace('mock_', '').replace('clerk_mock_token_', '').split('_')[0];
      
      // Create mock auth for rate limiting
      req.auth = { userId: clerkUserId, clerkUserId: clerkUserId };
      
      // Apply rate limiting
      const rateLimitCheck = tokenRateLimitMiddleware('generate');
      await new Promise((resolve, reject) => {
        rateLimitCheck(req, res, (err) => {
          if (err) reject(err);
          else if (res.headersSent) reject(new Error('Rate limit exceeded'));
          else resolve();
        });
      });
      
      const tokenData = await generateLongLivedToken(
        clerkUserId,
        deviceName || 'Development Token',
        ipAddress,
        userAgent
      );
      
      return res.status(200).json({
        success: true,
        access_token: tokenData.token,
        expires_in: LONG_LIVED_EXPIRES_SECONDS,
        expires_at: tokenData.expiresAtISO,
        token_type: 'Bearer',
        type: 'long_lived',
        usage: 'vscode_extension',
        token_id: tokenData.tokenId
      });
    }

    // Verify Clerk token
    const decoded = await verifyClerkToken(token);
    const clerkUserId = decoded.clerkUserId;

    // Verify user exists in database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkUserId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
        userMessage: 'Your account was not found. Please try signing in again.'
      });
    }

    // Set auth for rate limiting
    req.auth = { userId: userData.id, clerkUserId: clerkUserId };
    
    // Apply rate limiting
    const rateLimitCheck = tokenRateLimitMiddleware('generate');
    await new Promise((resolve, reject) => {
      rateLimitCheck(req, res, (err) => {
        if (err) reject(err);
        else if (res.headersSent) reject(new Error('Rate limit exceeded'));
        else resolve();
      });
    });

    const orgAttribution = await resolveOrgAttributionClaims(clerkUserId, clerkOrgId, decoded.claims);

    const tokenData = await generateLongLivedToken(
      clerkUserId,
      deviceName || 'VSCode Extension',
      ipAddress,
      userAgent,
      orgAttribution
    );

    res.status(200).json({
      success: true,
      access_token: tokenData.token,
      expires_in: LONG_LIVED_EXPIRES_SECONDS,
      expires_at: tokenData.expiresAtISO,
      token_type: 'Bearer',
      type: 'long_lived',
      usage: 'vscode_extension',
      token_id: tokenData.tokenId,
      message: 'Token generated successfully. Store it securely - it won\'t be shown again.'
    });

  } catch (error) {
    console.error('Long-lived token generation error:', error.message);
    
    // User-friendly error messages
    if (error.message.includes('Maximum of')) {
      return res.status(400).json({
        error: 'TOKEN_LIMIT_EXCEEDED',
        message: error.message,
        userMessage: error.message
      });
    }
    
    if (error.message.includes('Rate limit exceeded')) {
      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded',
        userMessage: 'Too many token generation requests. Please try again later.'
      });
    }
    
    res.status(500).json({
      error: 'GENERATION_FAILED',
      message: 'Failed to generate long-lived token',
      userMessage: 'An error occurred while generating your token. Please try again.'
    });
  }
}

export default handler;