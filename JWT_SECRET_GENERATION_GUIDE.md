# JWT Secret Generation Guide

## 🔐 How to Generate a Secure JWT Secret

The `JWT_SECRET` is used to sign and verify JWT tokens for VSCode extension authentication. You need a **cryptographically secure** secret for production.

## 🛠️ Methods to Generate JWT_SECRET

### Method 1: Using Node.js (Recommended)
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Example Output:**
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456789012345678901234567890abcdef1234567890abcdef
```

### Method 2: Using OpenSSL
```bash
openssl rand -hex 32
```

**Example Output:**
```
f8e7d6c5b4a39281706f5e4d3c2b1a09876f5e4d3c2b1a09876f5e4d3c2b1a09
```

### Method 3: Using Python
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### Method 4: Online Generator (Use with caution)
- **Only for development**: [generate-secret.vercel.app](https://generate-secret.vercel.app/)
- **⚠️ Never use online generators for production secrets**

## 🎯 Recommended Setup

### For Production:
```bash
# Generate a 64-character hex string (256 bits)
JWT_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456789012345678901234567890abcdef1234567890abcdef
```

### For Development:
```bash
# You can use a simpler secret for local development
JWT_SECRET=dev-jwt-secret-2024-softcodes-vscode-extension-auth
```

## 🔧 Update Your .env File

Replace the placeholder in your `.env`:

```bash
# Before (placeholder)
JWT_SECRET=vscode-auth-secret-key-production-change-this

# After (your generated secret)
JWT_SECRET=your-generated-secret-here
```

## 📋 Security Requirements

### ✅ Good JWT Secrets:
- **Length**: At least 32 characters (64+ recommended)
- **Randomness**: Cryptographically secure random generation
- **Uniqueness**: Different for each environment (dev/staging/prod)
- **Complexity**: Mix of letters, numbers, and special characters

### ❌ Bad JWT Secrets:
- `"secret"` - Too simple
- `"mypassword123"` - Predictable
- `"jwt-secret"` - Common/guessable
- Short strings - Vulnerable to brute force

## 🌍 Environment-Specific Secrets

### Development (.env.local)
```bash
JWT_SECRET=dev-local-secret-a1b2c3d4e5f6
```

### Staging (.env.staging)
```bash
JWT_SECRET=staging-secret-f8e7d6c5b4a3928170
```

### Production (.env.production)
```bash
JWT_SECRET=prod-secret-9876f5e4d3c2b1a09876f5e4d3c2b1a09876f5e4d3c2b1a0
```

## 🔄 Secret Rotation

For enhanced security, rotate your JWT secret periodically:

1. **Generate new secret**
2. **Update environment variables**
3. **Redeploy application**
4. **All existing tokens become invalid** (users need to re-authenticate)

## ⚡ Quick Command for Your Setup

Run this command to generate and set your JWT secret:

```bash
# Generate and display a secure JWT secret
echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")"
```

Copy the output and update your `.env` file.

## 🚨 Security Best Practices

1. **Never commit secrets to git**
2. **Use different secrets for each environment**
3. **Store production secrets in secure environment variable systems**
4. **Rotate secrets regularly**
5. **Never share secrets in plain text**
6. **Use environment variable management tools** (Vercel, Heroku, AWS Secrets Manager)

## 📝 Example .env Update

```bash
# Your updated .env file should look like this:

# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_publishable_key_here
CLERK_SECRET_KEY=sk_live_your_clerk_secret_key_here

# JWT Configuration (UPDATED)
JWT_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

# Webhook Configuration
CLERK_WEBHOOK_SECRET=whsec_your_clerk_webhook_secret_here

# Other configuration...
```

## ✅ Verification

After updating your JWT_SECRET, your VSCode authentication flow will use the new secret to:
- Sign access tokens
- Sign refresh tokens  
- Verify incoming tokens
- Secure the authentication bridge

The secret is used in [`api/utils/jwt.ts`](api/utils/jwt.ts) for all JWT operations.