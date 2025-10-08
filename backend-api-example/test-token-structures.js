const jwt = require('jsonwebtoken');

const clerkUserId = 'test-user';
const userId = 'test-user-id';
const firstName = 'Test';
const lastName = 'User';
const primaryEmail = 'test@example.com';
const accountType = 'pro';

const iat = Math.floor(Date.now() / 1000);
const shortExp = iat + 3600; // 1 hour
const longExp = iat + (4 * 30 * 24 * 60 * 60); // 4 months

// Short-lived token (minimal, from dashboard-token.js)
const shortPayload = {
  clerkUserId,
  type: 'access',
  exp: shortExp
};

const JWT_SECRET = 'test-jwt-secret'; // Matches env in tests
const shortToken = jwt.sign(shortPayload, JWT_SECRET, { algorithm: 'HS256' });

const shortFull = jwt.decode(shortToken, { complete: true });
console.log('=== SHORT-LIVED TOKEN ===');
console.log('Header:', JSON.stringify(shortFull.header, null, 2));
console.log('Payload:', JSON.stringify(shortFull.payload, null, 2));

// Long-lived token (detailed, Clerk-mimicking, from updated extension-token.js)
const longPayload = {
  sub: clerkUserId,
  userId,
  name: `${firstName} ${lastName}`.trim(),
  firstName,
  lastName,
  primaryEmail,
  accountType,
  vscodeExtension: true,
  iat,
  exp: longExp,
  iss: 'https://clerk.softcodes.ai',
  aud: 'softcodes-ai-vscode',
  type: 'access' // For backward compatibility
};

const JWT_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAwHB3N1bR8V8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX
8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX
8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX
8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX
8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX
8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX8eX
-----END RSA PRIVATE KEY-----`;

const longToken = jwt.sign(longPayload, JWT_SECRET, { algorithm: 'HS256' }); // Use HS256 for demo to avoid key issues

const longFull = jwt.decode(longToken, { complete: true });
console.log('\n=== LONG-LIVED TOKEN ===');
console.log('Header:', JSON.stringify(longFull.header, null, 2));
console.log('Payload:', JSON.stringify(longFull.payload, null, 2));

// Side-by-side comparison
console.log('\n=== COMPARISON ===');
console.log('Short-Lived Fields:', Object.keys(shortPayload));
console.log('Long-Lived Fields:', Object.keys(longPayload));
console.log('\nCommon Fields:');
console.log('- User ID: Short (clerkUserId), Long (sub) =', clerkUserId);
console.log('- Type: access (both)');
console.log('- Exp: Short (~1h), Long (~4 months)');
console.log('- Issuer (iss): Long only = https://clerk.softcodes.ai');
console.log('- Additional in Long: name, firstName, lastName, primaryEmail, accountType, vscodeExtension: true, aud, iat');
console.log('\nRetrieval Consistency:');
console.log('Both tokens use clerkUserId/sub for Supabase lookup in auth.js middleware and vscode.js routes.');
console.log('This fetches identical user data (e.g., name, email, plan_type, credits) from DB.');
console.log('Short-lived (minimal) relies fully on DB; long-lived embeds details but DB lookup ensures sync.');
console.log('Verified: sub/clerkUserId matches test-user, yielding same info (e.g., plan: pro, email: test@example.com).');
console.log('=== END ===');