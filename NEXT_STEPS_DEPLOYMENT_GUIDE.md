# 🚀 Next Steps: VSCode Authentication Bridge Deployment

Now that the VSCode Extension Authentication Bridge is fully implemented, here's your **step-by-step deployment roadmap**.

## 📋 Phase 1: Environment Configuration (Required First)

### 1.1 Generate JWT Secret
```bash
# Generate a secure JWT secret
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
```

### 1.2 Update .env File
```bash
# Update your .env with the generated secret
JWT_SECRET=your_generated_secret_here

# Add the webhook secret (you'll get this from Clerk)
CLERK_WEBHOOK_SECRET=whsec_your_clerk_webhook_secret_here
```

## 📋 Phase 2: Deploy Authentication Endpoints

### 2.1 Deploy New API Endpoints
Your new authentication bridge endpoints need to be deployed:

```bash
# Deploy these new endpoints to production:
api/auth/token.ts                    # ✅ Token exchange
api/auth/session-token.ts            # ✅ Session validation  
api/webhooks/clerk.ts                # ✅ User sync webhook
api/utils/jwt.ts                     # ✅ JWT utilities

# Updated endpoints:
api/extension/auth/callback.ts       # ✅ Enhanced dual-format support
api/auth/initiate-vscode-auth.ts     # ✅ Absolute URL support
```

### 2.2 Deployment Commands
Depending on your platform:

#### Vercel:
```bash
vercel --prod
```

#### Netlify:
```bash
netlify deploy --prod
```

#### Custom Server:
```bash
# Build and deploy to your server
npm run build
# Upload files to your production server
```

## 📋 Phase 3: Clerk Configuration

### 3.1 Configure Clerk Webhook
1. **Go to**: [Clerk Dashboard](https://dashboard.clerk.dev) → Your App → Webhooks
2. **Add Endpoint**: `https://softcodes.ai/api/webhooks/clerk`
3. **Select Events**:
   - ✅ `user.created`
   - ✅ `user.updated`
   - ✅ `user.deleted`
4. **Copy Secret**: Copy the webhook secret to your `.env`
5. **Test**: Send a test event to verify

### 3.2 Verify Clerk Settings
Ensure these settings match between website and VSCode extension:

```bash
# Website (.env)
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_FRONTEND_API=https://clerk.softcodes.ai

# VSCode Extension (should match)
PRODUCTION_CLERK_BASE_URL=https://clerk.softcodes.ai
PRODUCTION_ROO_CODE_API_URL=https://softcodes.ai
```

## 📋 Phase 4: Database Setup

### 4.1 Ensure Required Tables Exist
Check that these tables exist in your Supabase:

```sql
-- Verify these tables exist:
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('oauth_codes', 'refresh_tokens', 'users');

-- If missing, create them:
-- oauth_codes table (for OAuth flow)
-- refresh_tokens table (for token management)
-- users table (should already exist)
```

### 4.2 Add Refresh Tokens Table (if missing)
```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_session_id ON refresh_tokens(session_id);
```

## 📋 Phase 5: Testing & Validation

### 5.1 Test Endpoints Locally First
```bash
# Start local development server
npm run dev

# Test the authentication flow
node test-vscode-auth-bridge.js
```

### 5.2 Test Production Endpoints
```bash
# Test OAuth initiation
curl "https://softcodes.ai/api/auth/initiate-vscode-auth?redirect_uri=vscode://test&state=test123&code_challenge=test&code_challenge_method=S256"

# Test callback format detection
curl -X POST "https://softcodes.ai/api/extension/auth/callback" \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"authorization_code","code":"test","state":"test123"}'

# Test webhook endpoint
curl -X POST "https://softcodes.ai/api/webhooks/clerk" \
  -H "Content-Type: application/json" \
  -d '{"type":"user.created","data":{"id":"test_user"}}'
```

### 5.3 Webhook Testing
```bash
# For local webhook testing, use ngrok:
npx ngrok http 3000

# Use the ngrok URL in Clerk webhook config:
# https://abc123.ngrok.io/api/webhooks/clerk
```

## 📋 Phase 6: VSCode Extension Configuration

### 6.1 Update Extension Backend URLs
In the VSCode extension repository, ensure these match your deployed API:

```typescript
// src/auth/config.ts
export const PRODUCTION_CLERK_BASE_URL = "https://clerk.softcodes.ai"
export const PRODUCTION_ROO_CODE_API_URL = "https://softcodes.ai"
```

### 6.2 Test VSCode Extension Flow
1. **Install extension** in VSCode
2. **Trigger authentication** command
3. **Verify browser opens** to Clerk auth URL
4. **Complete authentication** in browser
5. **Check extension receives** JWT tokens
6. **Test API calls** work with Bearer token

## 📋 Phase 7: Monitoring & Verification

### 7.1 Check Logs
Monitor these logs after deployment:

```bash
# Webhook activity
"Processing Clerk webhook: user.created"
"User created: user_xxx (email@example.com)"

# Authentication flow
"VSCode authentication successful"
"JWT token generated for user: user_xxx"

# Errors to watch for
"Webhook verification failed"
"Invalid code verifier"
"User not found"
```

### 7.2 Verify Database Changes
```sql
-- Check users are being created via webhook
SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check OAuth sessions
SELECT COUNT(*) FROM oauth_codes WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check refresh tokens
SELECT COUNT(*) FROM refresh_tokens WHERE created_at > NOW() - INTERVAL '1 hour';
```

## 🎯 Success Criteria Checklist

### ✅ Deployment Complete When:
- [ ] All new API endpoints deployed and accessible
- [ ] JWT_SECRET and CLERK_WEBHOOK_SECRET configured
- [ ] Clerk webhook configured and receiving events
- [ ] Database tables exist and are accessible
- [ ] Local testing passes
- [ ] Production endpoints return expected responses
- [ ] VSCode extension can authenticate successfully
- [ ] Users auto-created in Supabase via webhook
- [ ] JWT tokens generated and validated correctly

## 🚨 Troubleshooting Common Issues

### Issue: "Invalid JSON response"
**Solution**: Check if API endpoints are deployed and accessible

### Issue: "Webhook verification failed"  
**Solution**: Verify CLERK_WEBHOOK_SECRET matches Clerk dashboard

### Issue: "User not found"
**Solution**: Ensure webhook is working and creating users in Supabase

### Issue: "Invalid code verifier"
**Solution**: Check PKCE implementation in VSCode extension

### Issue: "JWT verification failed"
**Solution**: Ensure JWT_SECRET is consistent across all environments

## 📞 Support

### Resources:
- **Implementation Details**: [`VSCODE_AUTH_BRIDGE_DOCUMENTATION.md`](VSCODE_AUTH_BRIDGE_DOCUMENTATION.md)
- **JWT Setup**: [`JWT_SECRET_GENERATION_GUIDE.md`](JWT_SECRET_GENERATION_GUIDE.md)
- **Test Script**: [`test-vscode-auth-bridge.js`](test-vscode-auth-bridge.js)

### Next Phase (Optional Enhancements):
1. **Multi-factor Authentication** support
2. **Organization switching** in VSCode
3. **Offline mode** with cached tokens
4. **Enhanced audit logging**
5. **Session management dashboard**

---

**🎉 Once you complete these steps, your VSCode Extension Authentication Bridge will be fully operational and production-ready!**