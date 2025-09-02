require('dotenv').config({ path: __dirname + '/.env' });
const axios = require('axios');
const crypto =require('crypto');
const { createClient } = require('@supabase/supabase-js');

// --- Configuration ---
const API_BASE_URL = `http://localhost:${process.env.PORT || 3001}`;
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- PKCE Utilities ---
function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32));
}

function sha256(plain) {
  return crypto.createHash('sha256').update(plain).digest();
}

function base64URLEncode(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier) {
  const hashed = await sha256(verifier);
  return base64URLEncode(hashed);
}

// --- Main Simulation Logic ---
async function simulateVSCodeAuthFlow() {
  console.log('--- Starting VS Code E2E Auth Simulation ---');

  // STEP 1: (VS Code Extension) Generate PKCE parameters and state
  const code_verifier = generateCodeVerifier();
  const code_challenge = await generateCodeChallenge(code_verifier);
  const state = crypto.randomBytes(16).toString('hex');
  const vscode_redirect_uri = 'vscode://softcodes.softcodes/auth-callback'; // The final redirect URI for VS Code
  console.log(`[VSCODE] Generated state: ${state}`);
  console.log(`[VSCODE] Generated code_verifier: ${code_verifier}`);
  console.log(`[VSCODE] Generated code_challenge: ${code_challenge}`);
  
  // STEP 2: (VS Code Extension) "Opens" the browser by navigating to the web app's initiator URL.
  // We need to manually pre-insert the record into supabase for this simulation.
  const testClerkUserId = `sim_user_${Date.now()}`;
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  
  const { error: insertError } = await supabase.from('oauth_codes').insert({
    state,
    code_challenge,
    redirect_uri: vscode_redirect_uri,
    expires_at,
  });

  if (insertError) {
    console.error('[SIM] Failed to create initial oauth_code record:', insertError);
    return;
  }
  console.log('[SIM] Successfully created initial oauth_code record in DB.');

  // STEP 3: (Web App) User authenticates. The callback page is hit.
  // The VscodeAuthCallback.tsx component calls the /api/auth/update-auth-code endpoint.
  console.log('\n--- Simulating Web App Callback ---');
  try {
    const updateResponse = await axios.post(`${API_BASE_URL}/api/auth/update-auth-code`, {
      state: state,
      clerk_user_id: testClerkUserId,
    });
    if (updateResponse.data.success) {
      console.log('[WEB-APP] Successfully called /update-auth-code.');
    } else {
      throw new Error('Update auth code call failed');
    }
  } catch (error) {
    console.error('[WEB-APP] Error calling /update-auth-code:', error.response?.data || error.message);
    return;
  }

  // STEP 4: (Web App) The web app redirects to the VS Code extension.
  const redirectedCode = testClerkUserId; // The web app passes the user ID as the 'code'
  const redirectedState = state;
  console.log(`\n--- Simulating Redirect to VS Code ---`);
  console.log(`[REDIRECT] VS Code receives: code=${redirectedCode}, state=${redirectedState}`);

  // STEP 5: (VS Code Extension) The extension's URI handler receives the redirect and exchanges the code for a token.
  // THIS IS THE CRITICAL STEP THAT IS LIKELY FAILING.
  console.log('\n--- Simulating VS Code Token Exchange ---');
  try {
    console.log('[VSCODE] Calling /api/auth/token with:');
    console.log(`  -> code (clerk_user_id): ${redirectedCode}`);
    console.log(`  -> code_verifier: ${code_verifier}`);
    console.log(`  -> state: ${redirectedState}`);
    console.log(`  -> redirect_uri: ${vscode_redirect_uri}`);

    const tokenResponse = await axios.post(`${API_BASE_URL}/api/auth/token`, {
      code: redirectedCode,
      code_verifier: code_verifier,
      state: redirectedState,
      redirect_uri: vscode_redirect_uri,
    });

    if (tokenResponse.data.success) {
      console.log('\n✅ SUCCESS! Token exchange was successful.');
      console.log('Received Access Token:', tokenResponse.data.access_token);
      console.log('Received Refresh Token:', tokenResponse.data.refresh_token);
    } else {
      throw new Error('Token exchange API call did not indicate success.');
    }
  } catch (error) {
    console.error('\n❌ FAILURE! Token exchange failed.');
    console.error('Error calling /api/auth/token:', error.response?.data || error.message);
    return;
  }
  
  console.log('\n--- Simulation Complete ---');
  console.log('Conclusion: The backend logic is correct. The failure lies in the VS Code extension\'s implementation of the token exchange step.');

  // Cleanup
  await supabase.from('oauth_codes').delete().eq('state', state);
}

(async () => {
    // Check if the server is running
    try {
        await axios.get(`${API_BASE_URL}/`); // Assuming server has a root endpoint that responds
    } catch (e) {
        console.error(`\nError: Could not connect to the backend server at ${API_BASE_URL}.`);
        console.error('Please start the server first by running: node backend-api-example/server.js\n');
        process.exit(1);
    }
    await simulateVSCodeAuthFlow();
})();