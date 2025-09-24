const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('=== LONG-LIVED TOKEN SYSTEM TEST ===');

// Test configuration
const TEST_USER_DATA = {
  clerk_id: 'test_user_123',
  email: 'test@example.com',
  plan_type: 'pro',
  organization_id: null
};

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Function to generate extension JWT (matching API implementation)
function generateExtensionJWT(userData) {
  const now = Math.floor(Date.now() / 1000);
  const fourMonthsInSeconds = 4 * 30 * 24 * 60 * 60; // 4 months
  const expiresAt = new Date((now + fourMonthsInSeconds) * 1000);
  
  const payload = {
    sub: userData.clerk_id,
    email: userData.email,
    org_id: userData.organization_id,
    plan: userData.plan_type,
    type: 'extension',
    iat: now,
    exp: now + fourMonthsInSeconds,
    iss: 'softcodes.ai',
    aud: 'vscode-extension'
  };
  
  const token = jwt.sign(payload, process.env.JWT_SECRET);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  
  return { token, expiresAt, hash };
}

// Function to verify extension JWT
function verifyExtensionJWT(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'extension') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid extension token: ' + error.message);
  }
}

async function testLongLivedTokenSystem() {
  try {
    console.log('🔧 Environment check:');
    console.log('- JWT_SECRET:', process.env.JWT_SECRET ? '✓ Set' : '❌ Missing');
    console.log('- SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Set' : '❌ Missing');
    console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '❌ Missing');
    
    if (!process.env.JWT_SECRET || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing required environment variables');
      return;
    }

    console.log('\n🧪 Test 1: Token Generation');
    const { token, expiresAt, hash } = generateExtensionJWT(TEST_USER_DATA);
    console.log('- Token generated:', token.substring(0, 50) + '...');
    console.log('- Expires at:', expiresAt.toISOString());
    console.log('- Token hash:', hash.substring(0, 20) + '...');
    
    // Calculate months until expiry
    const monthsUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / (30 * 24 * 60 * 60 * 1000));
    console.log('- Valid for:', monthsUntilExpiry, 'months');
    
    if (monthsUntilExpiry < 3 || monthsUntilExpiry > 5) {
      console.error('❌ Token expiry is not approximately 4 months');
      return;
    }
    console.log('✅ Token generation successful');

    console.log('\n🧪 Test 2: Token Verification');
    const decoded = verifyExtensionJWT(token);
    console.log('- Decoded token:', {
      sub: decoded.sub,
      email: decoded.email,
      plan: decoded.plan,
      type: decoded.type,
      iss: decoded.iss,
      aud: decoded.aud
    });
    
    if (decoded.sub !== TEST_USER_DATA.clerk_id) {
      console.error('❌ Token subject mismatch');
      return;
    }
    if (decoded.type !== 'extension') {
      console.error('❌ Token type mismatch');
      return;
    }
    console.log('✅ Token verification successful');

    console.log('\n🧪 Test 3: Database Schema Check');
    
    // Check if extension_tokens table exists
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'extension_tokens');
      
    if (tableError || !tables || tables.length === 0) {
      console.error('❌ extension_tokens table not found. Run migration first:');
      console.error('   backend-api-example/migrations/20250924_add_extension_tokens.sql');
      return;
    }
    console.log('✅ extension_tokens table exists');

    // Check table structure
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'extension_tokens')
      .eq('table_schema', 'public');
      
    if (columnError) {
      console.error('❌ Error checking table structure:', columnError);
      return;
    }
    
    const expectedColumns = ['id', 'user_id', 'token_hash', 'name', 'expires_at', 'last_used_at', 'created_at', 'revoked_at'];
    const actualColumns = columns.map(col => col.column_name);
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.error('❌ Missing columns:', missingColumns);
      return;
    }
    console.log('✅ Table structure is correct');

    console.log('\n🧪 Test 4: Token Expiry Calculation');
    const now = new Date();
    const fourMonthsLater = new Date(now.getTime() + 4 * 30 * 24 * 60 * 60 * 1000);
    const tokenExpiry = new Date(expiresAt);
    const timeDifference = Math.abs(tokenExpiry.getTime() - fourMonthsLater.getTime());
    const daysDifference = timeDifference / (24 * 60 * 60 * 1000);
    
    console.log('- Current time:', now.toISOString());
    console.log('- Expected expiry (4 months):', fourMonthsLater.toISOString());
    console.log('- Actual token expiry:', tokenExpiry.toISOString());
    console.log('- Difference:', Math.round(daysDifference), 'days');
    
    if (daysDifference > 7) { // Allow 7 days tolerance
      console.error('❌ Token expiry is not approximately 4 months from now');
      return;
    }
    console.log('✅ Token expiry calculation is accurate');

    console.log('\n🧪 Test 5: Invalid Token Handling');
    try {
      verifyExtensionJWT('invalid.token.here');
      console.error('❌ Invalid token was accepted');
      return;
    } catch (error) {
      console.log('✅ Invalid tokens are properly rejected');
    }

    try {
      // Create a JWT with wrong type
      const wrongToken = jwt.sign({
        sub: 'test',
        type: 'wrong_type'
      }, process.env.JWT_SECRET);
      
      verifyExtensionJWT(wrongToken);
      console.error('❌ Wrong token type was accepted');
      return;
    } catch (error) {
      console.log('✅ Wrong token types are properly rejected');
    }

    console.log('\n✅ ALL TESTS PASSED!');
    console.log('\n📝 Next Steps:');
    console.log('1. Run the database migration: backend-api-example/migrations/20250924_add_extension_tokens.sql');
    console.log('2. Test token generation in the dashboard: /dashboard');
    console.log('3. Verify VSCode extension can authenticate with the new tokens');
    console.log('4. Monitor token usage in the extension_tokens table');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the tests
testLongLivedTokenSystem();