# Clerk to Supabase Webhook Synchronization - Detailed Implementation Plan

## Prerequisites
- ✅ Clerk account and project set up
- ✅ Supabase project created
- ✅ Next.js application with Clerk authentication
- ✅ Supabase client configured

## Phase 1: Database Schema Updates

### 1.1 Apply Database Schema Changes
**Status: Ready to Execute**

You need to apply the updated schema to your Supabase database:

**Option A: Using Supabase Dashboard (Recommended)**
1. Open your Supabase project dashboard
2. Navigate to the SQL Editor
3. Create a new query
4. Copy and paste the following SQL to add the avatar_url column:

```sql
-- Add avatar_url column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update the upsert_user function to handle avatar_url
CREATE OR REPLACE FUNCTION upsert_user(
  p_clerk_id TEXT,
  p_email TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_plan_type TEXT DEFAULT 'starter'
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  INSERT INTO users (clerk_id, email, first_name, last_name, avatar_url, plan_type)
  VALUES (p_clerk_id, p_email, p_first_name, p_last_name, p_avatar_url, p_plan_type)
  ON CONFLICT (clerk_id) 
  DO UPDATE SET 
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW()
  RETURNING id INTO v_user_id;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

5. Click "Run" to execute the query
6. Verify the changes were applied successfully

**Option B: Using Migration File**
1. Create a new migration file in your project
2. Add the SQL above to the migration
3. Run the migration using your preferred migration tool

### 1.2 Verify Database Changes
- [ ] Confirm `avatar_url` column exists in `users` table
- [ ] Verify `upsert_user` function accepts `p_avatar_url` parameter
- [ ] Test the function works correctly

## Phase 2: Environment Configuration

### 2.1 Install Required Dependencies
**Status: You need to execute**

Ensure you have the required packages installed:

```bash
npm install svix @clerk/nextjs
# or
yarn add svix @clerk/nextjs
# or
bun add svix @clerk/nextjs
```

### 2.2 Set up ngrok for Local Development
**Status: You need to execute**

1. **Install ngrok:**
   ```bash
   # Using npm
   npm install -g ngrok
   
   # Using Homebrew (macOS)
   brew install ngrok
   
   # Or download from https://ngrok.com/
   ```

2. **Create ngrok account:**
   - Go to https://dashboard.ngrok.com/signup
   - Sign up for a free account
   - Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken

3. **Configure ngrok:**
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

4. **Start ngrok tunnel:**
   ```bash
   ngrok http 3000 --domain=your-static-domain.ngrok-free.app
   ```
   
   **Note:** Save your ngrok URL (e.g., `https://your-static-domain.ngrok-free.app`) - you'll need it for webhook configuration.

## Phase 3: Clerk Webhook Configuration

### 3.1 Create Webhook Endpoint in Clerk Dashboard
**Status: You need to execute**

1. **Navigate to Clerk Dashboard:**
   - Go to https://dashboard.clerk.com/
   - Select your project
   - Go to "Webhooks" section

2. **Create New Endpoint:**
   - Click "Add Endpoint"
   - **Endpoint URL:** `https://your-ngrok-url.ngrok-free.app/api/clerk/webhooks`
   - **Description:** "Supabase User Sync"

3. **Configure Events:**
   - Subscribe to these events:
     - ✅ `user.created`
     - ✅ `user.updated` 
     - ✅ `user.deleted`

4. **Save Configuration:**
   - Click "Create"
   - You'll be redirected to the endpoint settings page

### 3.2 Get Webhook Signing Secret
**Status: You need to execute**

1. On the endpoint settings page, copy the **Signing Secret**
2. The secret will look like: `whsec_...`
3. Keep this secret secure - you'll add it to your environment variables

### 3.3 Update Environment Variables
**Status: You need to execute**

Add the webhook signing secret to your `.env` file:

```env
# Existing Clerk variables
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Add this new line with your actual signing secret
CLERK_WEBHOOK_SIGNING_SECRET=whsec_your_actual_signing_secret_here

# Your existing Supabase variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Phase 4: Code Implementation

### 4.1 Webhook Route Handler
**Status: ✅ Completed**
- The webhook route handler has been created at `src/api/webhooks/route.ts`
- It handles webhook verification using Svix
- Processes `user.created`, `user.updated`, and `user.deleted` events
- Syncs user data to Supabase using the `upsert_user` function

### 4.2 Database Integration Updates
**Status: ✅ Completed**
- Updated `src/utils/supabase/database.ts` to include `avatar_url` in User interface
- Modified `userOperations.upsertUser` to handle `avatar_url` parameter
- Database schema has been updated to support avatar URLs

### 4.3 Middleware Configuration
**Status: You need to verify**

Ensure your webhook route is public in your middleware configuration:

```typescript
// middleware.ts or wherever you configure clerkMiddleware
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)', // Add this line
])

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

## Phase 5: Local Testing

### 5.1 Start Development Environment
**Status: You need to execute**

1. **Start your Next.js development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   bun dev
   ```

2. **Ensure ngrok is running:**
   ```bash
   ngrok http 3000 --domain=your-static-domain.ngrok-free.app
   ```

3. **Verify your app is accessible via ngrok:**
   - Open `https://your-ngrok-url.ngrok-free.app` in browser
   - Confirm your app loads correctly

### 5.2 Test Webhook with Clerk Dashboard
**Status: You need to execute**

1. **Go to your Clerk Dashboard webhook settings**
2. **Click on the "Testing" tab**
3. **Send test event:**
   - Select "user.created" from dropdown
   - Click "Send Example"
   - Check "Message Attempts" section for "Succeeded" status

4. **Verify in your terminal:**
   - You should see webhook payload logs
   - Look for: `Received webhook with ID ... and event type of user.created`

5. **Check Supabase database:**
   - Go to Supabase Dashboard > Table Editor > users table
   - Verify test user data was inserted

### 5.3 Test Real User Events
**Status: You need to execute**

1. **Test user.created:**
   - Go to your app's sign-up page
   - Create a new user account
   - Verify webhook fires and user is added to Supabase

2. **Test user.updated:**
   - Update user profile (name, avatar) in your app
   - Verify webhook fires and Supabase data updates

3. **Test user.deleted:**
   - Delete a user account (if implemented)
   - Verify webhook fires and appropriate action is taken

## Phase 6: Production Deployment

### 6.1 Deploy Application
**Status: You need to execute**

Deploy your application to your hosting platform:

**For Vercel:**
```bash
npm run build
vercel --prod
```

**For Netlify:**
```bash
npm run build
netlify deploy --prod
```

**For other platforms:** Follow your platform's deployment guide.

### 6.2 Configure Production Webhook
**Status: You need to execute**

1. **Create production webhook endpoint:**
   - Go to Clerk Dashboard > Webhooks
   - Click "Add Endpoint"
   - **Endpoint URL:** `https://your-production-domain.com/api/clerk/webhooks`
   - Subscribe to same events: `user.created`, `user.updated`, `user.deleted`

2. **Get production signing secret:**
   - Copy the signing secret from the new production endpoint
   - This will be different from your development secret

### 6.3 Update Production Environment Variables
**Status: You need to execute**

Add the production webhook signing secret to your hosting platform:

**For Vercel:**
- Go to Vercel Dashboard > Your Project > Settings > Environment Variables
- Add: `CLERK_WEBHOOK_SIGNING_SECRET` = `whsec_production_secret_here`

**For Netlify:**
- Go to Netlify Dashboard > Your Site > Site Settings > Environment Variables
- Add: `CLERK_WEBHOOK_SIGNING_SECRET` = `whsec_production_secret_here`

**For other platforms:** Add the environment variable through their interface.

### 6.4 Final Production Testing
**Status: You need to execute**

1. **Test production webhook:**
   - Use Clerk Dashboard testing tab for production endpoint
   - Verify webhook fires successfully

2. **Test production user flows:**
   - Create new user in production app
   - Update user profile
   - Verify all data syncs correctly to Supabase

## Troubleshooting Guide

### Common Issues and Solutions

**1. Webhook verification fails:**
- ✅ Verify `CLERK_WEBHOOK_SIGNING_SECRET` is correctly set
- ✅ Ensure signing secret matches the one from Clerk Dashboard
- ✅ Check webhook URL is accessible from internet

**2. TypeScript errors:**
- ✅ Install missing dependencies: `npm install svix @clerk/nextjs`
- ✅ Verify import statements are correct

**3. Database errors:**
- ✅ Ensure Supabase connection is working
- ✅ Verify `avatar_url` column exists in users table
- ✅ Check `upsert_user` function is updated

**4. Middleware issues:**
- ✅ Ensure `/api/webhooks` route is public
- ✅ Verify middleware configuration is correct

**5. ngrok issues:**
- ✅ Verify ngrok is running and tunnel is active
- ✅ Check ngrok URL is accessible
- ✅ Ensure webhook URL in Clerk matches ngrok URL

## Success Criteria

✅ **Database Schema Updated:** avatar_url column added, upsert_user function updated
✅ **Webhook Handler Created:** Route handler processes all three event types
✅ **Code Integration Complete:** Database operations support avatar URLs
⏳ **Local Testing Passed:** All webhook events work in development
⏳ **Production Deployed:** Application deployed with webhook functionality
⏳ **Production Tested:** All user events sync correctly in production

## Next Steps After Implementation

1. **Monitor webhook delivery:** Check Clerk Dashboard for failed webhook attempts
2. **Set up error alerting:** Add monitoring for webhook failures
3. **Consider rate limiting:** Implement rate limiting for webhook endpoint
4. **Add logging:** Enhanced logging for debugging webhook issues
5. **Database backups:** Ensure regular backups of Supabase data