# VSCode Extension Implementation Guide

## Overview
This guide provides the necessary implementation details for the VSCode extension to properly authenticate with softcodes.ai using the OAuth 2.0 PKCE flow with Clerk authentication.

## Prerequisites

### 1. Database Tables
Before implementing, ensure the following tables exist in your Supabase database:

```sql
-- Run this SQL in your Supabase SQL editor
CREATE TABLE IF NOT EXISTS oauth_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  state TEXT NOT NULL UNIQUE,
  redirect_uri TEXT NOT NULL,
  authorization_code TEXT UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_oauth_codes_state ON oauth_codes(state);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_authorization_code ON oauth_codes(authorization_code);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_clerk_user_id ON refresh_tokens(clerk_user_id);
```

### 2. Environment Variables
Add to your backend `.env` file:
```env
FRONTEND_URL=https://softcodes.ai
```

## VSCode Extension Implementation

### 1. Update package.json

Register the correct URI scheme handler in your extension's `package.json`:

```json
{
  "name": "softcodes-vsc",
  "contributes": {
    "commands": [
      {
        "command": "softcodes.authenticate",
        "title": "Softcodes: Sign In"
      },
      {
        "command": "softcodes.signOut",
        "title": "Softcodes: Sign Out"
      }
    ],
    "uriHandler": {
      "scheme": "vscode-softcodes"
    }
  }
}
```

### 2. PKCE Helper Functions

Create a file `src/auth/pkce.ts`:

```typescript
import * as crypto from 'crypto';

/**
 * Generate a cryptographically random code verifier for PKCE
 */
export function generateCodeVerifier(): string {
  return base64URLEncode(crypto.randomBytes(32));
}

/**
 * Generate code challenge from verifier
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return base64URLEncode(hash);
}

/**
 * Generate random state for CSRF protection
 */
export function generateState(): string {
  return base64URLEncode(crypto.randomBytes(16));
}

/**
 * Base64 URL encoding
 */
function base64URLEncode(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
```

### 3. Authentication Service

Create a file `src/auth/authService.ts`:

```typescript
import * as vscode from 'vscode';
import { generateCodeVerifier, generateCodeChallenge, generateState } from './pkce';

export class AuthenticationService {
  private static instance: AuthenticationService;
  private context: vscode.ExtensionContext;
  private pendingAuth: Map<string, { codeVerifier: string; state: string }> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  static getInstance(context: vscode.ExtensionContext): AuthenticationService {
    if (!AuthenticationService.instance) {
      AuthenticationService.instance = new AuthenticationService(context);
    }
    return AuthenticationService.instance;
  }

  /**
   * Initiate OAuth flow
   */
  async authenticate(): Promise<void> {
    try {
      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateState();

      // Store for later verification
      this.pendingAuth.set(state, { codeVerifier, state });
      await this.context.secrets.store(`pkce_${state}`, codeVerifier);

      // Build redirect URI
      const redirectUri = 'vscode-softcodes://auth/callback';
      
      // Call backend to initiate auth
      const backendUrl = await this.getBackendUrl();
      const response = await fetch(
        `${backendUrl}/api/auth/initiate-vscode-auth?redirect_uri=${encodeURIComponent(redirectUri)}`
      );

      if (!response.ok) {
        throw new Error('Failed to initiate authentication');
      }

      const data = await response.json();
      
      // Open browser with auth URL
      await vscode.env.openExternal(vscode.Uri.parse(data.auth_url));
      
      vscode.window.showInformationMessage('Please complete authentication in your browser');
    } catch (error) {
      vscode.window.showErrorMessage(`Authentication failed: ${error}`);
    }
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(uri: vscode.Uri): Promise<void> {
    try {
      const params = new URLSearchParams(uri.query);
      const code = params.get('code');
      const state = params.get('state');

      if (!code || !state) {
        throw new Error('Missing authentication parameters');
      }

      // Retrieve stored PKCE verifier
      const codeVerifier = await this.context.secrets.get(`pkce_${state}`);
      if (!codeVerifier) {
        throw new Error('Invalid authentication state');
      }

      // Exchange code for tokens
      const backendUrl = await this.getBackendUrl();
      const response = await fetch(`${backendUrl}/api/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          code_verifier: codeVerifier,
          state,
          redirect_uri: 'vscode-softcodes://auth/callback'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Token exchange failed');
      }

      const tokens = await response.json();
      
      // Store tokens securely
      await this.context.secrets.store('access_token', tokens.access_token);
      await this.context.secrets.store('refresh_token', tokens.refresh_token);
      
      // Clean up PKCE data
      await this.context.secrets.delete(`pkce_${state}`);
      this.pendingAuth.delete(state);

      vscode.window.showInformationMessage('Successfully authenticated with Softcodes!');
      
      // Trigger any post-auth actions
      vscode.commands.executeCommand('softcodes.onAuthenticated');
    } catch (error) {
      vscode.window.showErrorMessage(`Authentication callback failed: ${error}`);
    }
  }

  /**
   * Get access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string | undefined> {
    let accessToken = await this.context.secrets.get('access_token');
    
    // Check if token needs refresh (simplified - you should check expiry)
    if (!accessToken) {
      const refreshToken = await this.context.secrets.get('refresh_token');
      if (refreshToken) {
        accessToken = await this.refreshAccessToken(refreshToken);
      }
    }
    
    return accessToken;
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(refreshToken: string): Promise<string | undefined> {
    try {
      const backendUrl = await this.getBackendUrl();
      const response = await fetch(`${backendUrl}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!response.ok) {
        // Refresh failed, need to re-authenticate
        await this.signOut();
        return undefined;
      }

      const tokens = await response.json();
      
      // Store new tokens
      await this.context.secrets.store('access_token', tokens.access_token);
      await this.context.secrets.store('refresh_token', tokens.refresh_token);
      
      return tokens.access_token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return undefined;
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    await this.context.secrets.delete('access_token');
    await this.context.secrets.delete('refresh_token');
    vscode.window.showInformationMessage('Signed out from Softcodes');
  }

  /**
   * Check if authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }

  /**
   * Get backend URL from configuration or environment
   */
  private async getBackendUrl(): Promise<string> {
    const config = vscode.workspace.getConfiguration('softcodes');
    return config.get('backendUrl') || 'https://api.softcodes.ai';
  }
}
```

### 4. Extension Activation

Update your extension's `extension.ts`:

```typescript
import * as vscode from 'vscode';
import { AuthenticationService } from './auth/authService';

export function activate(context: vscode.ExtensionContext) {
  const authService = AuthenticationService.getInstance(context);

  // Register URI handler for OAuth callbacks
  const uriHandler = vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri) {
      if (uri.path === '/auth/callback') {
        authService.handleCallback(uri);
      }
    }
  });

  // Register authentication command
  const authenticateCommand = vscode.commands.registerCommand('softcodes.authenticate', () => {
    authService.authenticate();
  });

  // Register sign out command
  const signOutCommand = vscode.commands.registerCommand('softcodes.signOut', () => {
    authService.signOut();
  });

  // Register post-authentication handler
  const onAuthenticated = vscode.commands.registerCommand('softcodes.onAuthenticated', () => {
    // Refresh UI, enable features, etc.
    vscode.window.showInformationMessage('Softcodes features are now available!');
  });

  context.subscriptions.push(
    uriHandler,
    authenticateCommand,
    signOutCommand,
    onAuthenticated
  );

  // Check authentication status on activation
  authService.isAuthenticated().then(isAuth => {
    if (!isAuth) {
      vscode.window.showInformationMessage(
        'Sign in to Softcodes to enable AI features',
        'Sign In'
      ).then(selection => {
        if (selection === 'Sign In') {
          vscode.commands.executeCommand('softcodes.authenticate');
        }
      });
    }
  });
}

export function deactivate() {}
```

### 5. API Integration

Create a file `src/api/client.ts` for authenticated API calls:

```typescript
import * as vscode from 'vscode';
import { AuthenticationService } from '../auth/authService';

export class ApiClient {
  private authService: AuthenticationService;
  private baseUrl: string;

  constructor(context: vscode.ExtensionContext) {
    this.authService = AuthenticationService.getInstance(context);
    const config = vscode.workspace.getConfiguration('softcodes');
    this.baseUrl = config.get('backendUrl') || 'https://api.softcodes.ai';
  }

  /**
   * Make authenticated API request
   */
  async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const accessToken = await this.authService.getAccessToken();
    
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      // Token might be expired, try to refresh
      const newToken = await this.authService.getAccessToken();
      if (newToken && newToken !== accessToken) {
        // Retry with new token
        return this.request(endpoint, options);
      } else {
        // Re-authentication needed
        vscode.commands.executeCommand('softcodes.authenticate');
        throw new Error('Authentication required');
      }
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }

    return response.json();
  }

  /**
   * Validate session
   */
  async validateSession(sessionToken: string, extensionVersion: string): Promise<any> {
    return this.request('/api/vscode/session/validate', {
      method: 'POST',
      body: JSON.stringify({ sessionToken, extensionVersion })
    });
  }

  /**
   * Track usage
   */
  async trackUsage(data: any): Promise<any> {
    return this.request('/api/vscode/usage/track', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
}
```

### 6. Configuration Settings

Add to your extension's `package.json` contributions:

```json
{
  "contributes": {
    "configuration": {
      "title": "Softcodes",
      "properties": {
        "softcodes.backendUrl": {
          "type": "string",
          "default": "https://api.softcodes.ai",
          "description": "Backend API URL for Softcodes"
        }
      }
    }
  }
}
```

## Testing the Implementation

### 1. Local Testing
```bash
# Start the backend server
cd backend-api-example
npm start

# In VSCode extension development
# Set backendUrl to http://localhost:3001
# Press F5 to launch extension development host
```

### 2. Test Authentication Flow
1. Run command: "Softcodes: Sign In"
2. Browser should open to Clerk sign-in page
3. After signing in, should redirect back to VSCode
4. Check for success message

### 3. Verify Token Storage
```typescript
// In debug console
const token = await context.secrets.get('access_token');
console.log('Token stored:', !!token);
```

## Production Deployment

### 1. Update Backend URLs
- Ensure `FRONTEND_URL` environment variable is set to `https://softcodes.ai`
- Deploy backend changes to production

### 2. Extension Configuration
- Update default `backendUrl` to production API URL
- Ensure URI scheme matches what's registered

### 3. Publish Extension
```bash
vsce package
vsce publish
```

## Troubleshooting

### Common Issues

1. **"Failed to initiate authentication"**
   - Check if backend server is running
   - Verify database tables exist
   - Check network connectivity

2. **"Invalid authentication state"**
   - PKCE verifier not found
   - State mismatch
   - Session expired

3. **"Token exchange failed"**
   - Authorization code expired (10 min timeout)
   - PKCE challenge verification failed
   - Redirect URI mismatch

### Debug Logging

Add verbose logging for development:

```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('Auth URL:', data.auth_url);
  console.log('State:', state);
  console.log('Code verifier:', codeVerifier);
}
```

## Security Considerations

1. **Never expose** code_verifier or refresh_token in logs
2. **Always use HTTPS** in production
3. **Validate state** parameter to prevent CSRF
4. **Store tokens** in secure storage only (context.secrets)
5. **Implement token expiry** checking

## Support

For issues or questions:
- GitHub Issues: https://github.com/mathhhys/softcodes-vsc
- Documentation: https://softcodes.ai/docs
- Support Email: support@softcodes.ai