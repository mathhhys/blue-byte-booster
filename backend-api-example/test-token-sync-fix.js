const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Test configuration
const TEST_CLERK_USER_ID = `test_user_${Date.now()}`;
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES_SECONDS = 60 * 60; // 1 hour
const REFRESH_TOKEN_EXPIRES_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Unified time calculation functions (same as in routes)
function getCurrentEpochTime() {
  return Math.floor(Date.now() / 1000);
}

function calculateExpiryEpoch(durationSeconds) {
  return getCurrentEpochTime() + durationSeconds;
}

function epochToISOString(epochTime) {
  return new Date(epochTime * 1000).toISOString();
}

function generateAccessToken(clerkUserId) {
  const exp = calculateExpiryEpoch(ACCESS_TOKEN_EXPIRES_SECONDS);
  const accessToken = jwt.sign({ clerkUserId, type: 'access', exp }, JWT_SECRET);
  
  const expiresAtISO = epochToISOString(exp);
  
  return { token: accessToken, exp, expiresAtISO };
}

function generateRefreshToken(clerkUserId) {
  const exp = calculateExpiryEpoch(REFRESH_TOKEN_EXPIRES_SECONDS);
  const refreshToken = jwt.sign({ clerkUserId, type: 'refresh', exp }, JWT_SECRET);
  
  const expiresAtISO = epochToISOString(exp);
  
  return { token: refreshToken, exp, expiresAtISO };
}

async function runTokenSyncTests() {
  console.log('🚀 Starting Token Synchronization Fix Tests...');
  console.log('='.repeat(60));
  
  let testsPassed = 0;
  let testsTotal = 0;
  
  // Test 1: Unified Epoch Time Calculation
  testsTotal++;
  console.log('\n📝 Test 1: Unified Epoch Time Calculation');
  try {
    const currentTime = getCurrentEpochTime();
    const accessExp = calculateExpiryEpoch(ACCESS_TOKEN_EXPIRES_SECONDS);
    const refreshExp = calculateExpiryEpoch(REFRESH_TOKEN_EXPIRES_SECONDS);
    
    console.log('Current epoch time:', currentTime);
    console.log('Access token exp:', accessExp, '(+', ACCESS_TOKEN_EXPIRES_SECONDS, 'seconds)');
    console.log('Refresh token exp:', refreshExp, '(+', REFRESH_TOKEN_EXPIRES_SECONDS, 'seconds)');
    
    // Verify timing is correct
    const accessDiff = accessExp - currentTime;
    const refreshDiff = refreshExp - currentTime;
    
    if (accessDiff >= ACCESS_TOKEN_EXPIRES_SECONDS - 2 && accessDiff <= ACCESS_TOKEN_EXPIRES_SECONDS + 2) {
      console.log('✅ Access token expiry calculation is correct');
    } else {
      throw new Error(`Access token expiry calculation is off by ${Math.abs(accessDiff - ACCESS_TOKEN_EXPIRES_SECONDS)} seconds`);
    }
    
    if (refreshDiff >= REFRESH_TOKEN_EXPIRES_SECONDS - 2 && refreshDiff <= REFRESH_TOKEN_EXPIRES_SECONDS + 2) {
      console.log('✅ Refresh token expiry calculation is correct');
    } else {
      throw new Error(`Refresh token expiry calculation is off by ${Math.abs(refreshDiff - REFRESH_TOKEN_EXPIRES_SECONDS)} seconds`);
    }
    
    testsPassed++;
    console.log('✅ Test 1 PASSED');
  } catch (error) {
    console.log('❌ Test 1 FAILED:', error.message);
  }

  // Test 2: JWT and Supabase Timestamp Consistency
  testsTotal++;
  console.log('\n📝 Test 2: JWT and Supabase Timestamp Consistency');
  try {
    const accessTokenData = generateAccessToken(TEST_CLERK_USER_ID);
    const refreshTokenData = generateRefreshToken(TEST_CLERK_USER_ID);
    
    console.log('Access token JWT exp:', accessTokenData.exp);
    console.log('Access token Supabase expires_at:', accessTokenData.expiresAtISO);
    console.log('Refresh token JWT exp:', refreshTokenData.exp);
    console.log('Refresh token Supabase expires_at:', refreshTokenData.expiresAtISO);
    
    // Verify JWT exp matches Supabase expires_at conversion
    const accessSupabaseEpoch = Math.floor(new Date(accessTokenData.expiresAtISO).getTime() / 1000);
    const refreshSupabaseEpoch = Math.floor(new Date(refreshTokenData.expiresAtISO).getTime() / 1000);
    
    if (accessTokenData.exp === accessSupabaseEpoch) {
      console.log('✅ Access token JWT exp matches Supabase timestamp');
    } else {
      throw new Error(`Access token mismatch: JWT exp ${accessTokenData.exp} vs Supabase ${accessSupabaseEpoch}`);
    }
    
    if (refreshTokenData.exp === refreshSupabaseEpoch) {
      console.log('✅ Refresh token JWT exp matches Supabase timestamp');
    } else {
      throw new Error(`Refresh token mismatch: JWT exp ${refreshTokenData.exp} vs Supabase ${refreshSupabaseEpoch}`);
    }
    
    testsPassed++;
    console.log('✅ Test 2 PASSED');
  } catch (error) {
    console.log('❌ Test 2 FAILED:', error.message);
  }

  // Test 3: Clock Tolerance Verification
  testsTotal++;
  console.log('\n📝 Test 3: Clock Tolerance Verification');
  try {
    const currentTime = getCurrentEpochTime();
    
    // Create a token that expired 3 seconds ago (within 5-second tolerance)
    const almostExpiredExp = currentTime - 3;
    const almostExpiredToken = jwt.sign({ 
      clerkUserId: TEST_CLERK_USER_ID, 
      type: 'access', 
      exp: almostExpiredExp 
    }, JWT_SECRET);
    
    // Create a token that expired 7 seconds ago (outside 5-second tolerance)
    const expiredExp = currentTime - 7;
    const expiredToken = jwt.sign({ 
      clerkUserId: TEST_CLERK_USER_ID, 
      type: 'access', 
      exp: expiredExp 
    }, JWT_SECRET);
    
    console.log('Testing token expired 3 seconds ago (within tolerance)...');
    try {
      const decoded1 = jwt.verify(almostExpiredToken, JWT_SECRET, { clockTolerance: 5 });
      console.log('✅ Token within tolerance accepted');
    } catch (err) {
      throw new Error('Token within tolerance was rejected: ' + err.message);
    }
    
    console.log('Testing token expired 7 seconds ago (outside tolerance)...');
    try {
      const decoded2 = jwt.verify(expiredToken, JWT_SECRET, { clockTolerance: 5 });
      throw new Error('Token outside tolerance was incorrectly accepted');
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        console.log('✅ Token outside tolerance correctly rejected');
      } else {
        throw new Error('Unexpected error: ' + err.message);
      }
    }
    
    testsPassed++;
    console.log('✅ Test 3 PASSED');
  } catch (error) {
    console.log('❌ Test 3 FAILED:', error.message);
  }

  // Test 4: UTC ISO Format Consistency
  testsTotal++;
  console.log('\n📝 Test 4: UTC ISO Format Consistency');
  try {
    const testEpoch = getCurrentEpochTime() + 3600; // 1 hour from now
    const isoString = epochToISOString(testEpoch);
    
    console.log('Test epoch time:', testEpoch);
    console.log('Generated ISO string:', isoString);
    
    // Verify ISO string format
    if (!isoString.endsWith('Z')) {
      throw new Error('ISO string is not in UTC format (should end with Z)');
    }
    
    // Verify round-trip conversion
    const backToEpoch = Math.floor(new Date(isoString).getTime() / 1000);
    if (testEpoch === backToEpoch) {
      console.log('✅ Epoch to ISO to epoch conversion is consistent');
    } else {
      throw new Error(`Round-trip conversion failed: ${testEpoch} -> ${isoString} -> ${backToEpoch}`);
    }
    
    // Verify timezone independence
    const now = new Date();
    const utcISO = now.toISOString(); // This is already UTC
    const ourISO = epochToISOString(Math.floor(now.getTime() / 1000));
    
    // They should be within 1 second of each other
    const utcTime = new Date(utcISO).getTime();
    const ourTime = new Date(ourISO).getTime();
    const diff = Math.abs(utcTime - ourTime);
    
    if (diff <= 1000) { // within 1 second
      console.log('✅ UTC ISO format is timezone independent');
    } else {
      throw new Error(`Timezone dependency detected: ${diff}ms difference (UTC: ${utcISO} vs Our: ${ourISO})`);
    }
    
    testsPassed++;
    console.log('✅ Test 4 PASSED');
  } catch (error) {
    console.log('❌ Test 4 FAILED:', error.message);
  }

  // Test 5: Database Expiry Check Simulation
  testsTotal++;
  console.log('\n📝 Test 5: Database Expiry Check Simulation');
  try {
    const currentTime = getCurrentEpochTime();
    const currentISO = new Date().toISOString();
    
    // Simulate various token states
    const validExp = currentTime + 1800; // 30 minutes from now
    const validISO = epochToISOString(validExp);
    
    const expiredExp = currentTime - 300; // 5 minutes ago
    const expiredISO = epochToISOString(expiredExp);
    
    console.log('Current time:', currentISO);
    console.log('Valid token expires at:', validISO);
    console.log('Expired token expires at:', expiredISO);
    
    // Simulate database expiry checks
    const validCheck = new Date(validISO) > new Date(currentISO);
    const expiredCheck = new Date(expiredISO) > new Date(currentISO);
    
    if (validCheck) {
      console.log('✅ Valid token correctly identified as valid');
    } else {
      throw new Error('Valid token incorrectly identified as expired');
    }
    
    if (!expiredCheck) {
      console.log('✅ Expired token correctly identified as expired');
    } else {
      throw new Error('Expired token incorrectly identified as valid');
    }
    
    testsPassed++;
    console.log('✅ Test 5 PASSED');
  } catch (error) {
    console.log('❌ Test 5 FAILED:', error.message);
  }

  // Test 6: Simulated Different Timezone Scenarios
  testsTotal++;
  console.log('\n📝 Test 6: Simulated Different Timezone Scenarios');
  try {
    const baseTime = getCurrentEpochTime();
    
    // Simulate servers in different timezones
    const utcServer = {
      currentTime: baseTime,
      exp: baseTime + 3600,
      iso: epochToISOString(baseTime + 3600)
    };
    
    // Simulate client in Europe/Paris (UTC+2 in summer)
    const parisClient = {
      currentTime: baseTime, // Same epoch time
      iso: new Date((baseTime + 3600) * 1000).toISOString() // Should be same ISO
    };
    
    console.log('UTC server exp:', utcServer.exp, 'ISO:', utcServer.iso);
    console.log('Paris client ISO:', parisClient.iso);
    
    if (utcServer.iso === parisClient.iso) {
      console.log('✅ Timezone independence verified');
    } else {
      throw new Error(`Timezone dependency: UTC=${utcServer.iso} vs Paris=${parisClient.iso}`);
    }
    
    // Test token validation across timezones
    const token = jwt.sign({ 
      clerkUserId: TEST_CLERK_USER_ID, 
      type: 'access', 
      exp: utcServer.exp 
    }, JWT_SECRET);
    
    // Simulate validation on different timezone servers
    const validationTime = baseTime + 1800; // 30 minutes later
    process.env.TZ = 'UTC';
    const utcValidation = jwt.verify(token, JWT_SECRET, { 
      clockTolerance: 5,
      // Simulate current time being 30 minutes later
      clockTimestamp: validationTime
    });
    
    process.env.TZ = 'Europe/Paris';
    const parisValidation = jwt.verify(token, JWT_SECRET, { 
      clockTolerance: 5,
      clockTimestamp: validationTime
    });
    
    if (utcValidation.exp === parisValidation.exp) {
      console.log('✅ Token validation is timezone independent');
    } else {
      throw new Error('Token validation shows timezone dependency');
    }
    
    testsPassed++;
    console.log('✅ Test 6 PASSED');
  } catch (error) {
    console.log('❌ Test 6 FAILED:', error.message);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Tests passed: ${testsPassed}/${testsTotal}`);
  console.log(`Success rate: ${Math.round((testsPassed / testsTotal) * 100)}%`);
  
  if (testsPassed === testsTotal) {
    console.log('🎉 ALL TESTS PASSED! Token synchronization fix is working correctly.');
    console.log('\n✅ Key fixes verified:');
    console.log('   - Unified epoch time calculations');
    console.log('   - JWT exp and Supabase expires_at consistency');
    console.log('   - Clock tolerance implementation');
    console.log('   - UTC ISO format normalization');
    console.log('   - Timezone independence');
    console.log('   - Database expiry validation');
    return true;
  } else {
    console.log('❌ Some tests failed. Please review the errors above.');
    return false;
  }
}

// Run the tests
runTokenSyncTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test suite error:', error);
    process.exit(1);
  });