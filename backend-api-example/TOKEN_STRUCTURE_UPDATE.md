# Token Structure Update - Summary

## Overview
Updated the long-lived token generation to include comprehensive user information matching the Clerk token structure, while ensuring both short-lived and long-lived tokens retrieve identical user data.

## Changes Made

### 1. Updated `backend-api-example/routes/extension-token.js`

#### Added Dependencies
- Added `crypto` module for generating unique token IDs (jti) and session IDs

#### Enhanced Token Payload Structure
The long-lived token now includes:

**Header Fields:**
- `alg`: RS256 (algorithm)
- `typ`: JWT (token type)
- `kid`: Clerk Key ID (from env or default)
- `cat`: Clerk category/client ID (from env or default)

**Payload Fields:**
- `algorithm`: 'RS256'
- `azp`: 'https://www.softcodes.ai' (authorized party)
- `claims`: Nested object containing:
  - `accountType`: User's plan type from database
  - `exp`: Expiration timestamp (as string)
  - `firstName`: User's first name from database
  - `iat`: Issued at timestamp (as string)
  - `lastName`: User's last name from database
  - `primaryEmail`: User's email from database
  - `sessionId`: Generated session identifier
  - `sub`: Clerk user ID
  - `userId`: Clerk user ID (not database UUID)
  - `vscodeExtension`: true (flag for VS Code extension)
- `exp`: Expiration epoch (4 months)
- `iat`: Issued at epoch
- `iss`: 'https://clerk.softcodes.ai' (issuer)
- `jti`: Unique token identifier
- `lifetime`: 10368000 (4 months in seconds)
- `name`: 'vscode-extension'
- `nbf`: Not before epoch (iat - 5 seconds)
- `sub`: Clerk user ID

### 2. Data Retrieval from Supabase

The token generation now correctly:
- Fetches user data from Supabase: `id, first_name, last_name, email, plan_type`
- Uses `clerk_id` to lookup the user
- Populates the token with actual user information
- Uses Clerk ID as `userId` (not the database UUID)

### 3. Middleware Compatibility

The existing `middleware/auth.js` already handles:
- Nested `claims` structure extraction (lines 116-118)
- Fallback to RS256 verification for long-lived tokens
- Fallback to HS256 verification for short-lived tokens
- Database lookup using `clerkUserId` from either token type

## Token Comparison

### Long-Lived Token (RS256, 4 months)
```json
{
  "algorithm": "RS256",
  "azp": "https://www.softcodes.ai",
  "claims": {
    "accountType": "starter",
    "exp": "1770310934",
    "firstName": "Mathys ",
    "iat": "1759942934",
    "lastName": "Guillou",
    "primaryEmail": "mathys@softcodes.io",
    "sessionId": "40a0dc5099c4989808bb450a443c35e3",
    "sub": "user_32mSltWx9KkUkJe3sN2Bkym2w45",
    "userId": "user_32mSltWx9KkUkJe3sN2Bkym2w45",
    "vscodeExtension": true
  },
  "exp": 1770310934,
  "iat": 1759942934,
  "iss": "https://clerk.softcodes.ai",
  "jti": "85782820dcdc16e5d11c",
  "lifetime": 10368000,
  "name": "vscode-extension",
  "nbf": 1759942929,
  "sub": "user_32mSltWx9KkUkJe3sN2Bkym2w45"
}
```

### Short-Lived Token (HS256, 1 hour)
```json
{
  "clerkUserId": "user_32mSltWx9KkUkJe3sN2Bkym2w45",
  "type": "access",
  "exp": 1759946534
}
```

## Information Retrieval

Both tokens retrieve identical user information through:

1. **Clerk User ID Extraction**
   - Long-lived: `decoded.sub` or `decoded.claims.sub`
   - Short-lived: `decoded.clerkUserId`

2. **Database Lookup**
   ```sql
   SELECT id, clerk_id, plan_type 
   FROM users 
   WHERE clerk_id = 'user_32mSltWx9KkUkJe3sN2Bkym2w45'
   ```

3. **Additional Context**
   - Long-lived tokens include user details directly in payload (no extra DB queries needed)
   - Short-lived tokens require database lookup for all user information

## Benefits

1. **Rich Context**: Long-lived tokens carry user information for offline/cached scenarios
2. **Compatibility**: Maintains backward compatibility with short-lived tokens
3. **Security**: RS256 signing with private key for long-lived tokens
4. **Consistency**: Both token types retrieve identical user data via database lookup
5. **Clerk-like Structure**: Matches Clerk's token format for easier integration

## Testing

Created test scripts to verify:
- `debug-token-fetch.js`: Validates Supabase data retrieval
- `test-final-token.js`: Verifies complete payload structure
- `test-token-verification.js`: Compares token types and validates retrieval

All tests confirm that both token types correctly retrieve identical user information.