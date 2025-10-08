require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugUserFetch() {
  console.log('🔍 Debugging User Data Fetch\n');
  
  // Test with a known Clerk ID (update this with your actual test user)
  const testClerkId = 'user_32mSltWx9KkUkJe3sN2Bkym2w45'; // From your example
  
  console.log(`Looking up user with clerk_id: ${testClerkId}\n`);
  
  // 1. Check if user exists
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('clerk_id', testClerkId)
    .single();
  
  if (userError) {
    console.error('❌ Error fetching user:', userError);
    return;
  }
  
  if (!userData) {
    console.log('❌ User not found in database');
    return;
  }
  
  console.log('✅ User found in database:');
  console.log(JSON.stringify(userData, null, 2));
  console.log('\n');
  
  // 2. Check the specific fields we're querying
  const { data: specificFields, error: fieldsError } = await supabase
    .from('users')
    .select('id, first_name, last_name, email, plan_type')
    .eq('clerk_id', testClerkId)
    .single();
  
  if (fieldsError) {
    console.error('❌ Error fetching specific fields:', fieldsError);
    return;
  }
  
  console.log('📋 Specific fields query result:');
  console.log(JSON.stringify(specificFields, null, 2));
  console.log('\n');
  
  // 3. Show what the token payload would look like
  const { id: userId, first_name: firstName, last_name: lastName, email: primaryEmail, plan_type: accountType } = specificFields;
  
  const iat = Math.floor(Date.now() / 1000);
  const lifetime = 4 * 30 * 24 * 60 * 60; // 4 months
  const exp = iat + lifetime;
  
  const payload = {
    sub: testClerkId,
    userId: testClerkId, // Use Clerk ID instead of database UUID
    name: `${firstName || ''} ${lastName || ''}`.trim(),
    firstName,
    lastName,
    primaryEmail,
    accountType,
    vscodeExtension: true,
    iat,
    exp,
    iss: 'https://clerk.softcodes.ai',
    aud: 'softcodes-ai-vscode',
    azp: 'https://www.softcodes.ai',
    nbf: iat - 5, // Not before: 5 seconds before issued time
    algorithm: 'RS256',
    lifetime: lifetime,
    type: 'access'
  };
  
  console.log('🔑 Token payload that would be generated:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('\n');
  
  // 4. Generate and decode the token to verify
  try {
    const token = jwt.sign(payload, process.env.JWT_PRIVATE_KEY, { algorithm: 'RS256' });
    const decoded = jwt.decode(token, { complete: true });
    
    console.log('✅ Generated token decoded:');
    console.log('Header:', JSON.stringify(decoded.header, null, 2));
    console.log('Payload:', JSON.stringify(decoded.payload, null, 2));
  } catch (err) {
    console.error('❌ Error generating/decoding token:', err.message);
  }
}

debugUserFetch().catch(console.error);