# Clerk to Supabase Webhook Implementation - Execution Checklist

## ✅ COMPLETED (Already Done For You)

### 🗄️ Database Schema & Code
- [x] **Database Schema Updated**: `src/utils/supabase/schema.sql` modified to include `avatar_url` column
- [x] **Migration File Created**: `migrations/add_avatar_url_to_users.sql` ready to execute
- [x] **Database Types Updated**: `src/utils/supabase/database.ts` includes avatar_url in User interface
- [x] **Upsert Function Enhanced**: Updated to handle avatar_url parameter

### 🔧 Code Implementation  
- [x] **Webhook Handler Created**: `src/api/webhooks/route.ts` with full event processing
- [x] **Middleware Configured**: `middleware.ts` ensures webhook routes are public
- [x] **Environment Template**: `.env.example` with all required variables
- [x] **Test Script**: `scripts/test-webhook.js` for local testing

### 📋 Implementation Plan
- [x] **Detailed Guide**: `CLERK_WEBHOOK_IMPLEMENTATION_PLAN.md` with complete instructions

---

## 🚀 YOUR ACTION ITEMS (Execute These Steps)

### Step 1: Database Migration (5 minutes)
```bash
# Navigate to your Supabase Dashboard → SQL Editor
# Copy and paste the contents from: migrations/add_avatar_url_to_users.sql
# Click "Run" to execute the migration
```

**Verify Success:**
- Check that `avatar_url` column exists in your `users` table
- Confirm `upsert_user` function accepts `p_avatar_url` parameter

### Step 2: Install Dependencies (2 minutes)
```bash
npm install svix @clerk/nextjs
# or
yarn add svix @clerk/nextjs
```

### Step 3: Environment Variables (3 minutes)
```bash
# Copy your actual values to .env file:
CLERK_WEBHOOK_SIGNING_SECRET=whsec_your_actual_secret_here
```

### Step 4: Setup ngrok (5 minutes)
```bash
# Install ngrok
npm install -g ngrok

# Create account at https://dashboard.ngrok.com/signup
# Get your auth token and configure
ngrok config add-authtoken YOUR_AUTH_TOKEN

# Start tunnel (keep this running)
ngrok http 3000
```
**Save your ngrok URL** (e.g., `https://abc123.ngrok-free.app`)

### Step 5: Configure Clerk Webhook (5 minutes)
1. Go to [Clerk Dashboard](https://dashboard.clerk.com/) → Webhooks
2. Click "Add Endpoint"
3. **Endpoint URL**: `https://your-ngrok-url.ngrok-free.app/api/webhooks`
4. **Subscribe to events**: `user.created`, `user.updated`, `user.deleted`
5. Click "Create"
6. **Copy the Signing Secret** and add it to your `.env` file

### Step 6: Local Testing (10 minutes)
```bash
# Terminal 1: Start your Next.js app
npm run dev

# Terminal 2: Keep ngrok running
ngrok http 3000

# Terminal 3: Test the webhook
node scripts/test-webhook.js
```

**Test in Clerk Dashboard:**
1. Go to your webhook → Testing tab
2. Select "user.created" and click "Send Example"
3. Verify "Succeeded" status
4. Check your terminal for webhook logs
5. Check Supabase users table for test data

### Step 7: Production Deployment (10 minutes)
```bash
# Deploy your app
npm run build
vercel --prod  # or your hosting platform

# Create production webhook in Clerk Dashboard
# Endpoint URL: https://your-production-domain.com/api/webhooks
# Add production CLERK_WEBHOOK_SIGNING_SECRET to hosting platform
```

---

## 📊 VERIFICATION CHECKLIST

### ✅ Database Ready
- [ ] `avatar_url` column exists in `users` table
- [ ] `upsert_user` function updated and working
- [ ] Can connect to Supabase from your app

### ✅ Local Development Ready  
- [ ] ngrok installed and running
- [ ] Webhook endpoint configured in Clerk
- [ ] Environment variables set correctly
- [ ] Webhook test returns "Succeeded" status

### ✅ Code Integration Working
- [ ] Webhook handler responds to requests
- [ ] User data syncs to Supabase on creation
- [ ] User data updates on profile changes
- [ ] Console logs show webhook events

### ✅ Production Ready
- [ ] App deployed to hosting platform
- [ ] Production webhook configured
- [ ] Production environment variables set
- [ ] Production webhook tests successful

---

## 🔍 TROUBLESHOOTING QUICK FIXES

**Webhook Returns 400/500 Error:**
- Check `CLERK_WEBHOOK_SIGNING_SECRET` is correct
- Verify webhook URL includes `/api/webhooks`
- Ensure middleware allows public access to webhook route

**Database Connection Issues:**
- Verify Supabase credentials in `.env`
- Check if migration was applied correctly
- Test database connection separately

**ngrok Issues:**
- Ensure ngrok is running and tunnel is active
- Verify ngrok URL matches Clerk webhook configuration
- Check if ngrok auth token is configured

**TypeScript Errors:**
- Run `npm install svix @clerk/nextjs`
- Clear `.next` folder and restart dev server
- Check import statements in webhook handler

---

## 📚 KEY FILES REFERENCE

| File | Purpose | Status |
|------|---------|--------|
| `src/api/webhooks/route.ts` | Main webhook handler | ✅ Created |
| `src/utils/supabase/database.ts` | Database operations | ✅ Updated |
| `src/utils/supabase/schema.sql` | Database schema | ✅ Updated |
| `migrations/add_avatar_url_to_users.sql` | Migration file | ✅ Created |
| `middleware.ts` | Route protection | ✅ Created |
| `.env.example` | Environment template | ✅ Created |
| `scripts/test-webhook.js` | Testing utility | ✅ Created |

---

## 🎯 SUCCESS CRITERIA

You'll know it's working when:
1. ✅ Clerk Dashboard shows webhook "Succeeded" status
2. ✅ New users appear in your Supabase `users` table
3. ✅ User profile updates sync to Supabase
4. ✅ Console logs show webhook events being processed
5. ✅ No TypeScript/runtime errors in webhook handler

---

## 🆘 SUPPORT

If you encounter issues:
1. Check the detailed troubleshooting guide in `CLERK_WEBHOOK_IMPLEMENTATION_PLAN.md`
2. Verify each step in this checklist
3. Test webhook with `scripts/test-webhook.js`
4. Check Clerk Dashboard message attempts for error details

**Estimated Total Implementation Time: 30-45 minutes**