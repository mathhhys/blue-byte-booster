# Stripe Integration Deployment Guide

## 🎯 Current Configuration Status

### ✅ Completed
- **Pro Plan Monthly**: `price_1RvKJcH6gWxKcaTXQ4PITKei` ✅
- **Pro Plan Yearly**: `price_1RvKJtH6gWxKcaTXfeLXklqU` ✅
- **Stripe Keys**: Configured in `.env.local` ✅
- **Frontend Integration**: Complete ✅

### ⚠️ Pending
- **Teams Plan Prices**: Need to create in Stripe Dashboard
- **Backend API**: Deploy the provided Express.js server
- **Webhook Endpoint**: Configure in Stripe Dashboard

## 🚀 Quick Deployment Steps

### 1. Create Teams Plan Prices in Stripe

Go to your Stripe Dashboard → Products → Create Product:

**Teams Monthly Product:**
```
Product Name: Softcodes Teams Monthly
Price: $30.00 USD
Billing: Monthly
Type: Recurring
```

**Teams Yearly Product:**
```
Product Name: Softcodes Teams Yearly  
Price: $288.00 USD (20% discount from $360)
Billing: Yearly
Type: Recurring
```

After creating, update `src/utils/stripe/client.ts` with the new price IDs.

### 2. Deploy Backend API

#### Option A: Deploy to Vercel
```bash
cd backend-api-example
npm install
vercel --prod
```

#### Option B: Deploy to Railway
```bash
cd backend-api-example
npm install
railway login
railway deploy
```

#### Option C: Deploy to Heroku
```bash
cd backend-api-example
npm install
heroku create softcodes-stripe-api
git init
git add .
git commit -m "Initial commit"
heroku git:remote -a softcodes-stripe-api
git push heroku main
```

### 3. Environment Variables for Backend

Set these environment variables in your deployment platform:

```env
STRIPE_SECRET_KEY=sk_test_51HVzsoH6gWxKcaTXOpLqbv9LVJIy2u561G5fXG1W08Myzq6MJZ8lS6ya3Uk91V91fOLO23R5ExpMoviqgOuYdZOt00Ry03hVf2
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
SUPABASE_URL=https://xraquejellmoyrpqcirs.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
PORT=3001
```

### 4. Configure Stripe Webhooks

In your Stripe Dashboard → Webhooks → Add endpoint:

**Endpoint URL**: `https://your-api-domain.com/api/stripe/webhooks`

**Events to send**:
- `checkout.session.completed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the webhook signing secret and add it to your environment variables.

### 5. Update Frontend API URL

Update `src/utils/stripe/checkout.ts` to point to your deployed API:

```typescript
const response = await fetch('https://your-api-domain.com/api/stripe/create-checkout-session', {
  // ... rest of the code
});
```

## 🧪 Testing Your Integration

### Test Stripe Integration
1. Use Stripe test cards: `4242 4242 4242 4242`
2. Test both monthly and yearly billing
3. Test Teams plan with multiple seats
4. Verify webhook events in Stripe Dashboard

### Test User Flows
1. **Starter Plan**: Should grant 25 credits immediately
2. **Pro Plan**: Should redirect to Stripe, process payment, grant 500 credits
3. **Teams Plan**: Should handle seat selection, payment, and invitation system

### Verify Database Operations
Check your Supabase dashboard to ensure:
- Users are created correctly
- Credits are granted properly
- Subscriptions are recorded
- Team invitations are stored

## 🔧 Production Checklist

### Stripe Configuration
- [ ] Create Teams plan products and prices
- [ ] Update price IDs in code
- [ ] Configure webhook endpoints
- [ ] Test all payment flows
- [ ] Switch to live Stripe keys for production

### Backend Deployment
- [ ] Deploy API server
- [ ] Set environment variables
- [ ] Test API endpoints
- [ ] Configure CORS for your domain
- [ ] Set up monitoring and logging

### Database Setup
- [ ] Run Supabase schema in production
- [ ] Configure RLS policies
- [ ] Set up database backups
- [ ] Test all database operations

### Security
- [ ] Verify webhook signature validation
- [ ] Test RLS policies
- [ ] Secure API endpoints
- [ ] Use HTTPS everywhere

## 🚨 Important Notes

### Teams Plan Price IDs
After creating Teams products in Stripe, update these in `src/utils/stripe/client.ts`:

```typescript
teams: {
  monthly: {
    priceId: 'price_YOUR_TEAMS_MONTHLY_ID', // Replace this
    amount: 3000,
  },
  yearly: {
    priceId: 'price_YOUR_TEAMS_YEARLY_ID', // Replace this
    amount: 28800,
  },
},
```

### Webhook Security
Always verify webhook signatures in production:

```javascript
const sig = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
```

### Error Handling
The system includes comprehensive error handling, but monitor:
- Failed payments
- Webhook processing errors
- Database operation failures
- Credit allocation issues

## 📞 Support

If you encounter issues:
1. Check Stripe Dashboard for payment errors
2. Monitor webhook delivery in Stripe
3. Check Supabase logs for database errors
4. Verify environment variables are set correctly

Your authentication and payment system is now ready for production deployment! 🎉