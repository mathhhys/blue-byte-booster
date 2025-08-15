# Starter Plan Implementation Fix

## Problem Analysis

The starter plan implementation has several issues that prevent it from working correctly:

1. **Migration Conflict**: The migration file `20250813_add_starter_and_billing.sql` removes starter from subscription constraints but doesn't align with the main schema
2. **Missing Credit Assignment**: The starter plan API endpoint doesn't properly assign the 25 credits
3. **Incomplete Implementation**: The server.js starter endpoint lacks proper credit granting logic

## Database Schema Status

### ✅ What's Already Correct
- Main schema (`src/utils/supabase/schema.sql`) properly supports starter plans:
  - Users table allows 'starter' plan type (line 11)
  - Default credits set to 25 (line 12)
  - Subscriptions table correctly excludes starter plans (line 23)
  - `upsert_user` function handles starter plan (lines 185-208)

### ❌ What Needs Fixing
- Migration file conflicts with main schema
- Server.js starter endpoint doesn't grant credits properly
- Test script expects functionality that isn't implemented

## Implementation Plan

### 1. Database Migration Fix
Create new migration: `20250814_fix_starter_plan.sql`
```sql
-- Migration: Fix starter plan implementation
BEGIN;

-- Ensure users table supports starter plan (should already exist from main schema)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_type_check;
ALTER TABLE users ADD CONSTRAINT users_plan_type_check 
  CHECK (plan_type IN ('starter', 'pro', 'teams', 'enterprise'));

-- Ensure subscriptions table excludes starter (correct behavior)
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_type_check 
  CHECK (plan_type IN ('pro', 'teams', 'enterprise'));

-- Update upsert_user function to ensure it grants starter credits
CREATE OR REPLACE FUNCTION upsert_user(
  p_clerk_id TEXT,
  p_email TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_plan_type TEXT DEFAULT 'starter'
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_is_new_user BOOLEAN := FALSE;
BEGIN
  -- Check if user exists
  SELECT id INTO v_user_id FROM users WHERE clerk_id = p_clerk_id;
  
  IF v_user_id IS NULL THEN
    v_is_new_user := TRUE;
  END IF;
  
  INSERT INTO users (clerk_id, email, first_name, last_name, plan_type, credits)
  VALUES (p_clerk_id, p_email, p_first_name, p_last_name, p_plan_type, 
          CASE WHEN p_plan_type = 'starter' THEN 25 ELSE 0 END)
  ON CONFLICT (clerk_id) 
  DO UPDATE SET 
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = NOW()
  RETURNING id INTO v_user_id;
  
  -- Grant starter credits if this is a new starter user
  IF v_is_new_user AND p_plan_type = 'starter' THEN
    INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
    VALUES (v_user_id, 25, 'grant', 'Starter plan welcome credits');
  END IF;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
```

### 2. Server.js Starter Endpoint Fix
Update `/api/starter/process-signup` endpoint in `backend-api-example/server.js`:

```javascript
// Process starter plan signup (no payment required)
app.post('/api/starter/process-signup', async (req, res) => {
  try {
    const { clerkUserId, email, firstName, lastName } = req.body;

    if (!clerkUserId) {
      return res.status(400).json({ error: 'Clerk User ID is required' });
    }

    // Check if user already exists
    let user;
    try {
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('id, plan_type, credits')
        .eq('clerk_id', clerkUserId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (existingUser) {
        // User already exists, just return success
        return res.json({
          success: true,
          message: 'User already exists',
          data: {
            planType: existingUser.plan_type,
            credits: existingUser.credits,
            isExisting: true
          }
        });
      }

      // Create new user with starter plan
      const { data: newUserId, error: createError } = await supabase.rpc('upsert_user', {
        p_clerk_id: clerkUserId,
        p_email: email || 'unknown@example.com',
        p_first_name: firstName || null,
        p_last_name: lastName || null,
        p_plan_type: 'starter'
      });

      if (createError) throw createError;

      // Fetch the created user to verify credits
      const { data: createdUser, error: fetchNewError } = await supabase
        .from('users')
        .select('id, plan_type, credits')
        .eq('id', newUserId)
        .single();

      if (fetchNewError) throw fetchNewError;
      user = createdUser;

      // Ensure user has 25 credits (backup check)
      if (user.credits !== 25) {
        const { error: creditError } = await supabase.rpc('grant_credits', {
          p_clerk_id: clerkUserId,
          p_amount: 25 - user.credits,
          p_description: 'Starter plan credits adjustment',
          p_reference_id: null
        });

        if (creditError) throw creditError;
        user.credits = 25;
      }

    } catch (error) {
      console.error('Error handling user:', error);
      return res.status(500).json({ error: 'Failed to process user' });
    }

    res.json({
      success: true,
      message: 'Starter plan activated successfully',
      data: {
        planType: 'starter',
        credits: 25, // Always return 25 for starter plan
        isExisting: false
      }
    });

  } catch (error) {
    console.error('Error processing starter signup:', error);
    res.status(500).json({ error: 'Failed to process starter signup' });
  }
});
```

### 3. Test Script Updates
Update `backend-api-example/test-starter-plan.js` to properly test the implementation:

```javascript
// Test script for starter plan implementation
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const testStarterPlan = async () => {
  console.log('🧪 Testing Starter Plan Implementation...\n');

  const testUser = {
    clerk_id: `test_starter_${Date.now()}`,
    email: 'starter-test@example.com',
    first_name: 'Starter',
    last_name: 'Test'
  };

  try {
    // Test 1: Create starter user via API
    console.log('1️⃣ Testing starter plan API endpoint...');
    const response = await fetch('http://localhost:3001/api/starter/process-signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clerkUserId: testUser.clerk_id,
        email: testUser.email,
        firstName: testUser.first_name,
        lastName: testUser.last_name
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const apiResult = await response.json();
    console.log('✅ API endpoint response:', apiResult);

    if (!apiResult.success) {
      throw new Error(`API returned success: false`);
    }

    if (apiResult.data.credits !== 25) {
      throw new Error(`Expected 25 credits from API, got ${apiResult.data.credits}`);
    }

    // Test 2: Verify user was created with correct data
    console.log('\n2️⃣ Verifying user data in database...');
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('clerk_id', testUser.clerk_id)
      .single();

    if (fetchError) throw fetchError;
    
    console.log('✅ User data:', {
      id: user.id,
      clerk_id: user.clerk_id,
      email: user.email,
      plan_type: user.plan_type,
      credits: user.credits
    });

    if (user.plan_type !== 'starter') {
      throw new Error(`Expected plan_type 'starter', got '${user.plan_type}'`);
    }

    if (user.credits !== 25) {
      throw new Error(`Expected 25 credits, got ${user.credits}`);
    }

    // Test 3: Verify credit transaction was recorded
    console.log('\n3️⃣ Verifying credit transaction...');
    const { data: transactions, error: transError } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('transaction_type', 'grant');

    if (transError) throw transError;
    
    if (transactions.length === 0) {
      throw new Error('No credit transaction found for starter user');
    }

    const starterTransaction = transactions.find(t => t.amount === 25);
    if (!starterTransaction) {
      throw new Error('No 25-credit grant transaction found');
    }

    console.log('✅ Credit transaction found:', {
      amount: starterTransaction.amount,
      description: starterTransaction.description
    });

    // Test 4: Verify no subscription record exists
    console.log('\n4️⃣ Verifying no subscription record exists...');
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id);

    if (subError) throw subError;
    
    if (subscriptions.length > 0) {
      throw new Error(`Expected no subscriptions for starter plan, found ${subscriptions.length}`);
    }
    console.log('✅ No subscription records found (correct for starter plan)');

    // Test 5: Test duplicate user creation (should return existing)
    console.log('\n5️⃣ Testing duplicate user creation...');
    const duplicateResponse = await fetch('http://localhost:3001/api/starter/process-signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clerkUserId: testUser.clerk_id,
        email: testUser.email,
        firstName: testUser.first_name,
        lastName: testUser.last_name
      }),
    });

    const duplicateResult = await duplicateResponse.json();
    if (!duplicateResult.data.isExisting) {
      throw new Error('Expected isExisting: true for duplicate user');
    }
    console.log('✅ Duplicate user handling works correctly');

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await supabase.from('credit_transactions').delete().eq('user_id', user.id);
    await supabase.from('users').delete().eq('clerk_id', testUser.clerk_id);
    console.log('✅ Cleanup completed');

    console.log('\n🎉 All starter plan tests passed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    // Cleanup on error
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', testUser.clerk_id)
        .single();
      
      if (userData) {
        await supabase.from('credit_transactions').delete().eq('user_id', userData.id);
        await supabase.from('users').delete().eq('clerk_id', testUser.clerk_id);
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }
    
    process.exit(1);
  }
};

// Run the test
testStarterPlan();
```

### 4. Frontend Integration Points

The frontend components should work correctly once the backend is fixed, but verify these integration points:

1. **Starter Plan Signup Flow** (`src/utils/starter/signup.ts`)
2. **Auth Flow Modal** (`src/components/auth/AuthFlowModal.tsx`)
3. **Plan Configuration** (`src/config/plans.ts`) - already correct

## Implementation Steps

1. ✅ Analyze current schema (completed)
2. 🔄 Create new migration file to fix constraints
3. 🔄 Update upsert_user function to properly handle starter credits
4. 🔄 Fix server.js starter endpoint to ensure credit assignment
5. 🔄 Update test script to verify all functionality
6. 🔄 Test the complete implementation
7. 🔄 Verify frontend integration

## Expected Outcomes

After implementing these fixes:

1. **Starter users** will be created with exactly 25 credits
2. **Credit transactions** will be properly recorded
3. **No subscription records** will be created for starter users (correct behavior)
4. **API endpoint** will return consistent results
5. **Test script** will pass all checks
6. **Frontend integration** will work seamlessly

## Files to Modify

1. `backend-api-example/migrations/20250814_fix_starter_plan.sql` (new)
2. `backend-api-example/server.js` (update starter endpoint)
3. `backend-api-example/test-starter-plan.js` (enhance tests)
4. Run migration and test implementation