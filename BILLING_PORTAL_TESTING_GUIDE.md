# Billing Portal Testing Guide

## 🧪 **Testing the Comprehensive Billing Portal Implementation**

This guide provides step-by-step instructions to test all billing portal features and ensure proper functionality.

## 📋 **Pre-Testing Setup**

### Environment Variables Required
```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Clerk Configuration
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
CLERK_SECRET_KEY=sk_test_your_clerk_secret
```

### Database Requirements
Ensure your Supabase database has:
- `users` table with `stripe_customer_id` column
- `credit_transactions` table for transaction history
- `grant_credits` RPC function

## 🎯 **Test Scenarios**

### Test 1: Basic Navigation
1. **Start the application**: `npm run dev`
2. **Sign in** to your account
3. **Navigate to Dashboard** - verify sidebar shows "Billing" option
4. **Click "Billing"** in sidebar - should navigate to `/billing`
5. **Verify Billing page loads** with proper tabs and layout

### Test 2: Credit Purchase Flow
1. **Go to Dashboard** (`/dashboard`)
2. **Locate "Add Credits" section**
3. **Enter credit amount** (e.g., 500)
4. **Verify cost calculation** shows: "Cost: $7.00"
5. **Click "Add Credits" button**
6. **Should redirect to Stripe checkout page**
7. **Use Stripe test card**: `4242 4242 4242 4242`
8. **Complete payment**
9. **Should redirect to** `/billing/success`
10. **Verify success page** shows credit amount purchased

### Test 3: API Endpoint Testing
1. **Open browser console**
2. **Run API test**:
```javascript
fetch('/api/billing/credit-purchase', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    clerkUserId: 'your-clerk-user-id',
    credits: 500,
    amount: 7.00,
    currency: 'EUR'
  })
}).then(r => r.json()).then(console.log);
```

### Test 4: Webhook Processing
1. **Install Stripe CLI**: `brew install stripe/stripe-cli/stripe`
2. **Login to Stripe**: `stripe login`
3. **Start webhook forwarding**:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhooks
```
4. **Test webhook with credit purchase**:
```bash
stripe trigger payment_intent.succeeded --add payment_intent:metadata[clerk_user_id]=test-user --add payment_intent:metadata[credits]=500 --add payment_intent:metadata[purchase_type]=credit_purchase
```

### Test 5: Organization Billing
1. **Create an organization** in Clerk
2. **Navigate to** `/billing`
3. **Click "Organization" tab**
4. **Verify organization billing dashboard loads**
5. **Test subscription creation** (if admin)

## 🔍 **Manual Testing Checklist**

### ✅ **Credit Purchase System**
- [ ] Credit form validation works (min/max limits)
- [ ] Quick select buttons populate input correctly
- [ ] Cost calculation is accurate (1 credit = $0.014)
- [ ] Stripe checkout session creates successfully
- [ ] Payment completion redirects to success page
- [ ] Credits are added to user account after payment

### ✅ **Navigation & UI**
- [ ] Billing page accessible from sidebar
- [ ] All tabs load without errors
- [ ] Responsive design works on mobile/desktop
- [ ] Dark theme consistency maintained
- [ ] Loading states display properly

### ✅ **Error Handling**
- [ ] Invalid credit amounts show validation errors
- [ ] Network failures display user-friendly messages
- [ ] Unauthorized access redirects to sign-in
- [ ] API errors don't crash the application

### ✅ **Security**
- [ ] API endpoints require authentication
- [ ] Webhook signature verification works
- [ ] No sensitive data exposed in frontend
- [ ] CSRF protection in place

## 🐛 **Common Issues & Solutions**

### Issue: API 404 Error
**Solution**: Ensure API route is in correct location: `api/billing/credit-purchase.js`

### Issue: Webhook Not Triggering
**Solution**: 
1. Verify webhook endpoint URL is correct
2. Check Stripe webhook secret in environment
3. Use Stripe CLI for local testing

### Issue: Credits Not Added
**Solution**:
1. Check webhook logs in Vercel/console
2. Verify `grant_credits` function exists in Supabase
3. Check user exists in database

### Issue: Stripe Checkout Fails
**Solution**:
1. Verify Stripe keys are correct (test vs live)
2. Check customer creation in Stripe dashboard
3. Ensure amount is in correct format (cents)

## 📊 **Testing Results Expected**

### Successful Credit Purchase Flow:
1. ✅ Form validation works
2. ✅ Stripe session creates
3. ✅ Redirect to Stripe checkout
4. ✅ Payment processes successfully
5. ✅ Webhook fires and grants credits
6. ✅ User redirected to success page
7. ✅ Credit balance updates in dashboard

### API Response Examples:

**Credit Purchase Success:**
```json
{
  "success": true,
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

**Webhook Processing Success:**
```json
{
  "received": true
}
```

## 🚀 **Quick Test Script**

Save this as a browser bookmark for quick testing:
```javascript
javascript:(function(){
  const testCredit = async () => {
    try {
      const response = await fetch('/api/billing/credit-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkUserId: 'test-user',
          credits: 500,
          amount: 7,
          currency: 'EUR'
        })
      });
      const data = await response.json();
      console.log('API Test Result:', data);
      alert('Check console for API test results');
    } catch (e) {
      console.error('API Test Error:', e);
      alert('API test failed - check console');
    }
  };
  testCredit();
})();
```

Run this testing guide to verify all billing portal functionality works as expected!