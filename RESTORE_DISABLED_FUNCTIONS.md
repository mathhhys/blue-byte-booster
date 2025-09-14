# How to Restore Disabled API Functions

## What was temporarily disabled

To fix the 406 Supabase error and stay under Vercel's 12 function limit on the Hobby plan, the following API functions were temporarily moved to `temp-disabled-api/`:

### Moved Functions:
- `api/_tests_/` - Test files (2 functions)
- `api/organizations/` - Organization management (2 functions) 
- `api/extension/` - VSCode extension auth (1 function)
- `api/auth/` - Authentication endpoints (4 functions)
- `api/credits/` - Credit management (1 function)
- `api/stripe/` - Stripe billing (1 function)

### Remaining Core Functions (4 total):
- `api/clerk/webhooks.ts` - Clerk webhook handler
- `api/user/get.ts` - Get user data (needed for 406 fix)
- `api/user/initialize.ts` - Initialize new users
- `api/utils/jwt.ts` - JWT utilities

## How to Restore After 406 Fix

1. **After confirming the 406 error is fixed**, move functions back:
   ```bash
   mv temp-disabled-api/_tests_ api/
   mv temp-disabled-api/organizations api/
   mv temp-disabled-api/extension api/
   mv temp-disabled-api/auth api/
   mv temp-disabled-api/credits api/
   mv temp-disabled-api/stripe api/
   ```

2. **Update vercel.json** to include the restored functions

3. **Restore Dashboard.tsx functionality**:
   - Re-enable credit addition feature
   - Re-enable billing portal functionality
   - Remove temporary disabled messages

4. **Consider upgrading to Vercel Pro** for unlimited functions

## Priority Order for Restoration

1. **First**: `api/user/` functions (for core user management)
2. **Second**: `api/clerk/webhooks.ts` (for user sync)
3. **Third**: `api/credits/` (for credit management)
4. **Fourth**: `api/stripe/` (for billing)
5. **Fifth**: `api/auth/` and `api/extension/` (for VSCode integration)
6. **Last**: `api/organizations/` and `api/_tests_/`