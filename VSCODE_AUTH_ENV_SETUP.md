# VSCode Extension Authentication - Environment Variables Setup

This document describes all required environment variables for the VSCode Extension OAuth 2.0 with PKCE authentication system.

## Required Environment Variables

### 1. JWT Secret

**Variable:** `JWT_SECRET`  
**Required:** Yes  
**Description:** Secret key used to sign and verify JWT tokens (access and refresh tokens)  
**How to Generate:**
```bash
# Generate a secure random secret (256-bit)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example:**
```bash
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**Security Notes:**
- Must be at least 32 characters (256-bit)
- Keep this secret secure and never commit to version control
- Use different secrets for development and production
- Rotate periodically for enhanced security

---

### 2. Supabase Configuration

**Variables:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`  
**Required:** Yes  
**Description:** Supabase project URL and service role key for database operations

**Where to Find:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy the Project URL and service_role key

**Example:**
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Also set for client-side:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_URL=https://your-project-id.supabase.co
```

**Security Notes:**
- Service role key bypasses Row Level Security - keep it secure
- Never expose service role key to client-side code
- Use anon key for client-side operations

---

### 3. Clerk Configuration

**Variables:** `NEXT_PUBLIC_CLERK_FRONTEND_API`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`  
**Required:** Yes  
**Description:** Clerk authentication service configuration

**Where to Find:**
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Go to API Keys

**Example:**
```bash
# Frontend API (your Clerk domain)
NEXT_PUBLIC_CLERK_FRONTEND_API=clerk.yourapp.com

# Publishable key (client-side safe)
CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxx
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxx
```

**Alternative Domain Variables:**
```bash
CLERK_DOMAIN=clerk.yourapp.com
```

**Security Notes:**
- Never commit CLERK_SECRET_KEY to version control
- Publishable key is safe for client-side use
- Configure allowed redirect URIs in Clerk Dashboard

---

### 4. Application URLs

**Variables:** `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`  
**Required:** Yes  
**Description:** Your application's public URLs

**Example (Production):**
```bash
NEXT_PUBLIC_APP_URL=https://softcodes.ai
NEXT_PUBLIC_BASE_URL=https://softcodes.ai
```

**Example (Development):**
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Usage:**
- Used to construct callback URLs
- Must match your deployment domain
- Include protocol (http:// or https://)
- No trailing slash

---

## Complete .env.local Example

```bash
# ============================================
# JWT Configuration
# ============================================
JWT_SECRET=your_secure_random_secret_here_at_least_32_chars

# ============================================
# Supabase Configuration
# ============================================
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

# ============================================
# Clerk Authentication
# ============================================
NEXT_PUBLIC_CLERK_FRONTEND_API=clerk.yourapp.com
CLERK_DOMAIN=clerk.yourapp.com
CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxx
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxx

# ============================================
# Application URLs
# ============================================
NEXT_PUBLIC_APP_URL=https://softcodes.ai
NEXT_PUBLIC_BASE_URL=https://softcodes.ai

# ============================================
# Optional: Stripe (if using billing features)
# ============================================
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxx
```

---

## Database Setup

After setting up environment variables, run the database migration:

```bash
# Connect to your Supabase database
psql <your-database-connection-string>

# Run the OAuth authentication migration
\i migrations/oauth_authentication_tables.sql
```

Or use Supabase SQL Editor:
1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Paste contents of `migrations/oauth_authentication_tables.sql`
4. Run the query

---

## Verifying Configuration

### Check Environment Variables

Create a test script to verify variables are loaded:

```javascript
// test-env.js
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✓ Set' : '✗ Missing');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing');
console.log('CLERK_SECRET_KEY:', process.env.CLERK_SECRET_KEY ? '✓ Set' : '✗ Missing');
console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL || '✗ Missing');
```

Run with:
```bash
node -r dotenv/config test-env.js
```

### Test Database Connection

```bash
# Test Supabase connection
curl -X GET \
  "https://your-project-id.supabase.co/rest/v1/users?limit=1" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

### Test Clerk Configuration

Visit your app and try signing in to verify Clerk is configured correctly.

---

## Deployment Checklist

- [ ] All required environment variables are set
- [ ] JWT_SECRET is different from development
- [ ] SUPABASE_SERVICE_ROLE_KEY is correct for production database
- [ ] CLERK_SECRET_KEY is for production Clerk instance
- [ ] Application URLs match your production domain
- [ ] Database migration has been run
- [ ] Clerk redirect URIs include production URLs
- [ ] Environment variables are set in deployment platform (Vercel/Netlify/etc.)

---

## Troubleshooting

### "Server configuration error"
- Check that all required variables are set
- Verify no typos in variable names
- Ensure .env.local is in project root
- Restart development server after adding variables

### "Invalid token" errors
- Verify JWT_SECRET is set and matches between services
- Check token hasn't expired
- Ensure JWT_SECRET hasn't changed

### "User not found"
- Run database migration
- Check Clerk webhook is syncing users to Supabase
- Verify SUPABASE_URL and keys are correct

### CORS errors
- Check NEXT_PUBLIC_APP_URL matches your domain
- Verify Clerk allowed origins include your domain
- Ensure redirect URIs are whitelisted in Clerk

---

## Security Best Practices

1. **Never commit .env files to version control**
   - Add `.env.local` to `.gitignore`
   - Use `.env.example` for documentation only

2. **Rotate secrets regularly**
   - Change JWT_SECRET periodically
   - Regenerate API keys if compromised

3. **Use different secrets per environment**
   - Development, staging, and production should have different secrets

4. **Monitor for suspicious activity**
   - Set up logging for failed auth attempts
   - Monitor token refresh patterns

5. **Keep dependencies updated**
   - Regular security updates for all packages
   - Monitor for vulnerabilities

---

## Support

For issues or questions:
- Check [Clerk Documentation](https://clerk.com/docs)
- Review [Supabase Documentation](https://supabase.com/docs)
- See [OAuth 2.0 RFC](https://tools.ietf.org/html/rfc6749)
