# 🔗 Clerk Webhook Setup Guide

## How to Make Your Webhooks Work with Real Clerk Events

Your webhooks are correctly implemented and secure, but you need to configure them in the Clerk Dashboard to receive real webhook events.

---

## 📋 Step-by-Step Setup

### 1. **Get Your Webhook Endpoints**
You have two webhook endpoints available:
- **Primary**: `https://www.softcodes.ai/api/clerk/webhooks` (uses `CLERK_WEBHOOK_SIGNING_SECRET`)
- **Alternative**: `https://www.softcodes.ai/api/webhooks/clerk` (uses `CLERK_WEBHOOK_SECRET`)

### 2. **Configure in Clerk Dashboard**

1. **Login to Clerk Dashboard**: Go to [clerk.dev](https://clerk.dev) and access your project
2. **Navigate to Webhooks**: Go to `Configure` → `Webhooks`
3. **Create Webhook Endpoint**:
   - Click "Add Endpoint"
   - **Endpoint URL**: `https://www.softcodes.ai/api/clerk/webhooks`
   - **Events to Listen For**: Select the events you need:
     - `user.created` ✅
     - `user.updated` ✅
     - `user.deleted` ✅
     - `organization.membership.created` (if using organizations)

### 3. **Get Webhook Signing Secret**

After creating the webhook endpoint:
1. **Copy the Signing Secret**: It will look like `whsec_xxxxxxxxxxxxxxxxx`
2. **Add to Environment Variables**:

```bash
# For /api/clerk/webhooks endpoint
CLERK_WEBHOOK_SIGNING_SECRET=whsec_your_actual_secret_here

# For /api/webhooks/clerk endpoint (alternative)
CLERK_WEBHOOK_SECRET=whsec_your_actual_secret_here
```

### 4. **Deploy Environment Variables**

**For Vercel:**
```bash
# Add to Vercel environment variables
vercel env add CLERK_WEBHOOK_SIGNING_SECRET production
# Enter your secret: whsec_xxxxxxxxxxxxxxxxx

# Redeploy
vercel --prod
```

**For other platforms**, add the environment variable in your hosting platform's dashboard.

---

## 🧪 Testing Your Setup

### Test 1: Trigger a Real Webhook
1. **Create a test user** in your app (sign up)
2. **Check your server logs** for webhook processing
3. **Verify user creation** in your Supabase database

### Test 2: Manual Webhook Test
Run this test to check if your environment variables are configured:

```javascript
// Create this file: scripts/test-real-webhook-config.js
console.log('🔍 Checking webhook configuration...');
console.log('CLERK_WEBHOOK_SIGNING_SECRET:', process.env.CLERK_WEBHOOK_SIGNING_SECRET ? '✅ Set' : '❌ Missing');
console.log('CLERK_WEBHOOK_SECRET:', process.env.CLERK_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing');
console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
```

---

## 🔧 Common Issues & Solutions

### Issue 1: "Webhook secret not configured"
**Solution**: Environment variable not set in production
```bash
# Check your hosting platform's environment variables
# Make sure CLERK_WEBHOOK_SIGNING_SECRET is set
```

### Issue 2: "Webhook verification failed"
**Solutions**:
1. **Wrong secret**: Copy the exact secret from Clerk Dashboard
2. **Wrong endpoint**: Make sure Clerk is sending to the correct URL
3. **Environment**: Ensure the secret is set in the correct environment (production)

### Issue 3: Webhook endpoint returns 404
**Solution**: Redeploy your application after adding the webhook files

---

## 📊 Environment Variables Checklist

Make sure these are set in your **production environment**:

```bash
# Clerk Configuration
CLERK_WEBHOOK_SIGNING_SECRET=whsec_xxx  # From Clerk Dashboard
CLERK_PUBLISHABLE_KEY=pk_xxx            # Your Clerk publishable key  
CLERK_SECRET_KEY=sk_xxx                 # Your Clerk secret key

# Supabase Configuration  
VITE_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx           # Service role key (not anon key!)

# Optional: For alternative endpoint
CLERK_WEBHOOK_SECRET=whsec_xxx          # Same as CLERK_WEBHOOK_SIGNING_SECRET
```

---

## 🎯 Expected Behavior After Setup

Once properly configured:

1. **User signs up** → Clerk sends `user.created` webhook → User added to Supabase
2. **User updates profile** → Clerk sends `user.updated` webhook → User updated in Supabase  
3. **User deletes account** → Clerk sends `user.deleted` webhook → User marked for deletion

**Success indicators:**
- ✅ 200 responses in Clerk webhook logs
- ✅ Users appear in your Supabase `users` table
- ✅ No 400/500 errors in your server logs

---

## 🔍 Debug Webhook Issues

### Check Clerk Webhook Logs
1. Go to Clerk Dashboard → Webhooks
2. Click on your webhook endpoint
3. Check the "Events" tab for delivery status

### Check Your Server Logs
Your webhook handlers include extensive logging. Look for:
- `🚀 Clerk webhook handler called`
- `✅ Successfully upserted user`
- `❌ Error` messages

### Test Webhook Connectivity
```bash
# Test if Clerk can reach your endpoint
curl -X POST https://www.softcodes.ai/api/clerk/webhooks
# Should return: {"error":"No Svix headers found."}
```

---

## 🚀 Next Steps

1. **Configure webhook in Clerk Dashboard** (steps above)
2. **Add environment variable** with your webhook secret
3. **Redeploy your application**
4. **Test by creating a user** in your app
5. **Check logs and database** to confirm it's working

Your webhook implementation is already secure and production-ready!