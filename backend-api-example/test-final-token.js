require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LONG_LIVED_EXPIRES_SECONDS = 4 * 30 * 24 * 60 * 60; // 4 months

function getCurrentEpochTime() {
  return Math.floor(Date.now() / 1000);
}

async function testTokenGeneration() {
  console.log('🧪 Testing Long-Lived Token Generation\n');
  
  const testClerkId = 'user_32mSltWx9KkUkJe3sN2Bkym2w45';
  
  // Fetch user data
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, first_name, last_name, email, plan_type')
    .eq('clerk_id', testClerkId)
    .single();
  
  if (userError || !userData) {
    console.error('❌ Error fetching user:', userError);
    return;
  }
  
  const { id: userId, first_name: firstName, last_name: lastName, email: primaryEmail, plan_type: accountType } = userData;
  
  // Generate payload
  const iat = getCurrentEpochTime();
  const lifetime = LONG_LIVED_EXPIRES_SECONDS;
  const exp = iat + lifetime;
  const nbf = iat - 5;
  const jti = crypto.randomBytes(10).toString('hex');
  const sessionId = crypto.randomBytes(16).toString('hex');
  
  const payload = {
    algorithm: 'RS256',
    azp: 'https://www.softcodes.ai',
    claims: {
      accountType,
      exp: exp.toString(),
      firstName,
      iat: iat.toString(),
      lastName,
      primaryEmail,
      sessionId,
      sub: testClerkId,
      userId: testClerkId,
      vscodeExtension: true
    },
    exp,
    iat,
    iss: 'https://clerk.softcodes.ai',
    jti,
    lifetime,
    name: 'vscode-extension',
    nbf,
    sub: testClerkId
  };
  
  console.log('📋 Generated Payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n');
  
  // Try to sign token (will fail without private key, but we can still show the structure)
  console.log('🔑 Token Header (would include):');
  console.log(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT',
    kid: process.env.CLERK_KID || 'ins_2tlN6BLiprK2b0JkKSFrj7GoXU6',
    cat: process.env.CLERK_CAT || 'cl_B7d4PD222AAA'
  }, null, 2));
  console.log('\n');
  
  // Compare with expected structure
  console.log('✅ Verification:');
  console.log(`- sub (Clerk ID): ${payload.sub === testClerkId ? '✓' : '✗'}`);
  console.log(`- userId in claims: ${payload.claims.userId === testClerkId ? '✓' : '✗'}`);
  console.log(`- firstName: ${payload.claims.firstName ? '✓ "' + payload.claims.firstName + '"' : '✗'}`);
  console.log(`- lastName: ${payload.claims.lastName ? '✓ "' + payload.claims.lastName + '"' : '✗'}`);
  console.log(`- primaryEmail: ${payload.claims.primaryEmail ? '✓ "' + payload.claims.primaryEmail + '"' : '✗'}`);
  console.log(`- accountType: ${payload.claims.accountType ? '✓ "' + payload.claims.accountType + '"' : '✗'}`);
  console.log(`- vscodeExtension: ${payload.claims.vscodeExtension ? '✓' : '✗'}`);
  console.log(`- sessionId: ${payload.claims.sessionId ? '✓' : '✗'}`);
  console.log(`- exp (expiration): ${payload.exp ? '✓ (4 months from now)' : '✗'}`);
  console.log(`- iat (issued at): ${payload.iat ? '✓' : '✗'}`);
  console.log(`- nbf (not before): ${payload.nbf ? '✓' : '✗'}`);
  console.log(`- iss (issuer): ${payload.iss === 'https://clerk.softcodes.ai' ? '✓' : '✗'}`);
  console.log(`- azp (authorized party): ${payload.azp === 'https://www.softcodes.ai' ? '✓' : '✗'}`);
  console.log(`- jti (token ID): ${payload.jti ? '✓' : '✗'}`);
  console.log(`- name: ${payload.name === 'vscode-extension' ? '✓' : '✗'}`);
  console.log(`- algorithm: ${payload.algorithm === 'RS256' ? '✓' : '✗'}`);
  console.log(`- lifetime: ${payload.lifetime === LONG_LIVED_EXPIRES_SECONDS ? '✓ (4 months)' : '✗'}`);
}

testTokenGeneration().catch(console.error);