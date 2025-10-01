# VSCode Extension - JWT Authentication Implementation Guide

This guide provides complete implementation instructions for the Softcodes.ai VSCode extension to work with the JWT token authentication system.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Implementation Steps](#implementation-steps)
5. [Code Examples](#code-examples)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Overview

The VSCode extension uses a long-lived JWT token (30 days) generated from the Softcodes.ai dashboard. The token is automatically refreshed before expiry to keep the user connected without manual re-authentication.

### Authentication Flow

```
User → Dashboard → Generate Token → Copy Token → Paste in VSCode → Auto-Refresh
```

### Key Features

- ✅ Secure token storage using VSCode's `SecretStorage` API
- ✅ Automatic token refresh 1 day before expiry
- ✅ Graceful handling of expired or revoked tokens
- ✅ API request interceptor with automatic retry on 401
- ✅ User-friendly authentication commands

---

## Prerequisites

### Required Dependencies

Add these to your `package.json`:

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.2",
    "node-fetch": "^3.3.2"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node-fetch": "^2.6.9"
  }
}
```

### Environment Configuration

The extension should detect the environment automatically:

- **Production**: `https://www.softcodes.ai/api/extension`
- **Development**: `http://localhost:3000/api/extension`

---

## Installation

### Step 1: Create Service Files

Create the following directory structure:

```
src/
├── services/
│   ├── tokenStorage.ts
│   ├── authService.ts
│   └── apiService.ts
├── types/
│   └── auth.ts
└── extension.ts
```

### Step 2: Install Dependencies

```bash
npm install jsonwebtoken node-fetch
npm install --save-dev @types/jsonwebtoken @types/node-fetch
```

---

## Implementation Steps

### 1. Token Storage Service

**File:** `src/services/tokenStorage.ts`

```typescript
import * as vscode from 'vscode';

const TOKEN_KEY = 'softcodes.accessToken';
const REFRESH_TOKEN_KEY = 'softcodes.refreshToken';
const TOKEN_EXPIRY_KEY = 'softcodes.tokenExpiry';
const SESSION_ID_KEY = 'softcodes.sessionId';

export class TokenStorageService {
  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Store authentication tokens securely
   */
  async storeTokens(
    accessToken: string,
    refreshToken: string,
    expiresAt: string,
    sessionId: string
  ): Promise<void> {
    await this.context.secrets.store(TOKEN_KEY, accessToken);
    await this.context.secrets.store(REFRESH_TOKEN_KEY, refreshToken);
    await this.context.globalState.update(TOKEN_EXPIRY_KEY, expiresAt);
    await this.context.globalState.update(SESSION_ID_KEY, sessionId);
  }

  /**
   * Get access token from secure storage
   */
  async getAccessToken(): Promise<string | undefined> {
    return await this.context.secrets.get(TOKEN_KEY);
  }

  /**
   * Get refresh token from secure storage
   */
  async getRefreshToken(): Promise<string | undefined> {
    return await this.context.secrets.get(REFRESH_TOKEN_KEY);
  }

  /**
   * Get token expiry timestamp
   */
  async getTokenExpiry(): Promise<string | undefined> {
    return this.context.globalState.get<string>(TOKEN_EXPIRY_KEY);
  }

  /**
   * Get session ID
   */
  async getSessionId(): Promise<string | undefined> {
    return this.context.globalState.get<string>(SESSION_ID_KEY);
  }

  /**
   * Clear all stored tokens
   */
  async clearTokens(): Promise<void> {
    await this.context.secrets.delete(TOKEN_KEY);
    await this.context.secrets.delete(REFRESH_TOKEN_KEY);
    await this.context.globalState.update(TOKEN_EXPIRY_KEY, undefined);
    await this.context.globalState.update(SESSION_ID_KEY, undefined);
  }

  /**
   * Check if token is expired or will expire within 1 day
   */
  async isTokenExpired(): Promise<boolean> {
    const expiry = await this.getTokenExpiry();
    if (!expiry) return true;

    const expiryDate = new Date(expiry);
    const now = new Date();
    
    // Consider expired if less than 1 day remaining
    const oneDayInMs = 24 * 60 * 60 * 1000;
    return (expiryDate.getTime() - now.getTime()) < oneDayInMs;
  }
}
```

### 2. Authentication Service

**File:** `src/services/authService.ts`

```typescript
import * as vscode from 'vscode';
import { TokenStorageService } from './tokenStorage';
import jwt from 'jsonwebtoken';

// Environment-aware API base URL
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://www.softcodes.ai/api/extension'
  : 'http://localhost:3000/api/extension';

export class AuthService {
  private tokenStorage: TokenStorageService;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.tokenStorage = new TokenStorageService(context);
  }

  /**
   * Authenticate with token from dashboard
   */
  async authenticateWithToken(token: string): Promise<boolean> {
    try {
      // Decode token to get expiry and session info
      const decoded = this.decodeToken(token);
      
      if (!decoded || decoded.type !== 'access') {
        vscode.window.showErrorMessage('Invalid token format. Please copy the access token from the dashboard.');
        return false;
      }

      // Validate token with backend
      const isValid = await this.validateToken(token);
      
      if (!isValid) {
        vscode.window.showErrorMessage('Token validation failed. Please generate a new token from the dashboard.');
        return false;
      }

      // Ask for refresh token
      const refreshToken = await vscode.window.showInputBox({
        prompt: 'Please enter the refresh token (shown below the access token in the dashboard)',
        password: true,
        ignoreFocusOut: true,
        placeHolder: 'Paste refresh token here...'
      });

      if (!refreshToken) {
        vscode.window.showErrorMessage('Refresh token is required for automatic token renewal.');
        return false;
      }

      // Verify refresh token format
      const decodedRefresh = this.decodeToken(refreshToken);
      if (!decodedRefresh || decodedRefresh.type !== 'refresh') {
        vscode.window.showErrorMessage('Invalid refresh token format.');
        return false;
      }

      // Store tokens
      const expiresAt = new Date(decoded.exp * 1000).toISOString();
      await this.tokenStorage.storeTokens(
        token,
        refreshToken,
        expiresAt,
        decoded.session_id
      );

      // Setup auto-refresh
      await this.setupAutoRefresh();

      vscode.window.showInformationMessage('✓ Successfully authenticated with Softcodes.ai!');
      return true;

    } catch (error) {
      console.error('Authentication error:', error);
      vscode.window.showErrorMessage(
        `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  }

  /**
   * Decode JWT without verification (for reading payload)
   */
  private decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      // Handle base64url encoding
      let payload = parts[1];
      payload = payload.replace(/-/g, '+').replace(/_/g, '/');
      
      // Add padding if needed
      const padding = 4 - (payload.length % 4);
      if (padding !== 4) {
        payload += '='.repeat(padding);
      }

      const decoded = Buffer.from(payload, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Token decode error:', error);
      return null;
    }
  }

  /**
   * Validate token with backend
   */
  private async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      return data.valid === true;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  /**
   * Setup automatic token refresh
   */
  private async setupAutoRefresh(): Promise<void> {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    const expiry = await this.tokenStorage.getTokenExpiry();
    if (!expiry) return;

    const expiryDate = new Date(expiry);
    const now = new Date();
    
    // Refresh 1 day before expiry
    const refreshTime = expiryDate.getTime() - now.getTime() - (24 * 60 * 60 * 1000);

    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(async () => {
        await this.refreshAccessToken();
      }, refreshTime);

      const hours = Math.floor(refreshTime / 1000 / 60 / 60);
      console.log(`[Softcodes] Auto-refresh scheduled in ${hours} hours`);
    } else {
      // Token expires soon, refresh immediately
      console.log('[Softcodes] Token expires soon, refreshing now...');
      await this.refreshAccessToken();
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = await this.tokenStorage.getRefreshToken();
      const currentToken = await this.tokenStorage.getAccessToken();

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      console.log('[Softcodes] Refreshing access token...');

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
          current_token: currentToken
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Refresh failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.success && data.access_token && data.refresh_token) {
        // Store new tokens
        const decoded = this.decodeToken(data.access_token);
        await this.tokenStorage.storeTokens(
          data.access_token,
          data.refresh_token,
          data.expires_at,
          decoded.session_id
        );

        // Reschedule auto-refresh
        await this.setupAutoRefresh();

        console.log('[Softcodes] Token refreshed successfully');
        vscode.window.showInformationMessage('Softcodes.ai: Authentication token refreshed automatically');
        return true;
      }

      throw new Error('Invalid refresh response');

    } catch (error) {
      console.error('[Softcodes] Token refresh error:', error);
      vscode.window.showWarningMessage(
        'Softcodes.ai: Token refresh failed. Please re-authenticate from the dashboard.'
      );
      
      // Clear invalid tokens
      await this.tokenStorage.clearTokens();
      return false;
    }
  }

  /**
   * Get current valid access token (auto-refresh if needed)
   */
  async getAccessToken(): Promise<string | null> {
    // Check if token exists
    const token = await this.tokenStorage.getAccessToken();
    if (!token) return null;

    // Check if expired or expiring soon
    const isExpired = await this.tokenStorage.isTokenExpired();
    if (isExpired) {
      console.log('[Softcodes] Token expired or expiring soon, refreshing...');
      
      // Try to refresh
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) return null;
      
      // Get new token
      return await this.tokenStorage.getAccessToken() || null;
    }

    return token;
  }

  /**
   * Sign out and clear all tokens
   */
  async signOut(): Promise<void> {
    await this.tokenStorage.clearTokens();
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    console.log('[Softcodes] Signed out successfully');
    vscode.window.showInformationMessage('Signed out from Softcodes.ai');
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return token !== null;
  }

  /**
   * Get authentication status details
   */
  async getAuthStatus(): Promise<{
    isAuthenticated: boolean;
    expiresAt?: string;
    sessionId?: string;
  }> {
    const isAuth = await this.isAuthenticated();
    
    if (!isAuth) {
      return { isAuthenticated: false };
    }

    const expiresAt = await this.tokenStorage.getTokenExpiry();
    const sessionId = await this.tokenStorage.getSessionId();

    return {
      isAuthenticated: true,
      expiresAt,
      sessionId
    };
  }
}
```

### 3. API Request Service

**File:** `src/services/apiService.ts`

```typescript
import * as vscode from 'vscode';
import { AuthService } from './authService';

const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://www.softcodes.ai/api/extension'
  : 'http://localhost:3000/api/extension';

export class ApiService {
  constructor(private authService: AuthService) {}

  /**
   * Make authenticated API request with automatic retry on 401
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.authService.getAccessToken();
    
    if (!token) {
      throw new Error('Not authenticated. Please sign in from the command palette.');
    }

    const url = `${API_BASE_URL}${endpoint}`;
    
    const makeRequest = async (authToken: string) => {
      return await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
    };

    // First attempt
    let response = await makeRequest(token);

    // Handle 401 Unauthorized - try to refresh and retry
    if (response.status === 401) {
      console.log('[Softcodes] Received 401, attempting token refresh...');
      
      const refreshed = await this.authService.refreshAccessToken();
      
      if (refreshed) {
        // Retry request with new token
        const newToken = await this.authService.getAccessToken();
        if (newToken) {
          response = await makeRequest(newToken);
        } else {
          throw new Error('Authentication failed after token refresh');
        }
      } else {
        throw new Error('Authentication failed. Please sign in again.');
      }
    }

    // Handle other errors
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Validate session with backend
   */
  async validateSession(sessionToken: string, extensionVersion: string): Promise<any> {
    return this.request('/vscode/session/validate', {
      method: 'POST',
      body: JSON.stringify({
        sessionToken,
        extensionVersion
      })
    });
  }

  /**
   * Track usage for analytics
   */
  async trackUsage(data: {
    sessionToken: string;
    action: string;
    modelId: string;
    tokensUsed: number;
    costInCredits: number;
  }): Promise<any> {
    return this.request('/vscode/usage/track', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Get user analytics
   */
  async getAnalytics(timeframe: '1d' | '7d' | '30d' = '7d'): Promise<any> {
    return this.request(`/vscode/analytics?timeframe=${timeframe}`);
  }

  /**
   * Get user profile and credits
   */
  async getUserProfile(): Promise<any> {
    return this.request('/user/profile');
  }
}
```

### 4. Extension Entry Point

**File:** `src/extension.ts`

```typescript
import * as vscode from 'vscode';
import { AuthService } from './services/authService';
import { ApiService } from './services/apiService';

let authService: AuthService;
let apiService: ApiService;

export function activate(context: vscode.ExtensionContext) {
  console.log('[Softcodes] Extension activating...');

  // Initialize services
  authService = new AuthService(context);
  apiService = new ApiService(authService);

  // Register authenticate command
  const authenticateCommand = vscode.commands.registerCommand(
    'softcodes.authenticate',
    async () => {
      const token = await vscode.window.showInputBox({
        prompt: 'Enter your authentication token from the Softcodes.ai dashboard',
        password: true,
        ignoreFocusOut: true,
        placeHolder: 'Paste your access token here...',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Token cannot be empty';
          }
          // Basic JWT format check
          if (value.split('.').length !== 3) {
            return 'Invalid token format. Please copy the token from the dashboard.';
          }
          return null;
        }
      });

      if (token) {
        const success = await authService.authenticateWithToken(token.trim());
        if (success) {
          // Refresh any views or status bars
          vscode.commands.executeCommand('softcodes.refreshStatus');
        }
      }
    }
  );

  // Register sign out command
  const signOutCommand = vscode.commands.registerCommand(
    'softcodes.signOut',
    async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to sign out?',
        'Yes',
        'No'
      );

      if (confirm === 'Yes') {
        await authService.signOut();
        vscode.commands.executeCommand('softcodes.refreshStatus');
      }
    }
  );

  // Register refresh token command
  const refreshCommand = vscode.commands.registerCommand(
    'softcodes.refreshToken',
    async () => {
      const success = await authService.refreshAccessToken();
      if (success) {
        vscode.window.showInformationMessage('✓ Token refreshed successfully');
      }
    }
  );

  // Register view status command
  const statusCommand = vscode.commands.registerCommand(
    'softcodes.viewStatus',
    async () => {
      const status = await authService.getAuthStatus();
      
      if (status.isAuthenticated) {
        const expiryDate = new Date(status.expiresAt!);
        const now = new Date();
        const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        vscode.window.showInformationMessage(
          `✓ Authenticated\nToken expires: ${expiryDate.toLocaleString()}\n(${daysRemaining} days remaining)`
        );
      } else {
        vscode.window.showWarningMessage(
          'Not authenticated. Use "Softcodes: Authenticate" to sign in.'
        );
      }
    }
  );

  // Register refresh status command (internal)
  const refreshStatusCommand = vscode.commands.registerCommand(
    'softcodes.refreshStatus',
    async () => {
      // Update status bar, views, etc.
      console.log('[Softcodes] Status refreshed');
    }
  );

  context.subscriptions.push(
    authenticateCommand,
    signOutCommand,
    refreshCommand,
    statusCommand,
    refreshStatusCommand
  );

  // Check authentication status on activation
  checkAuthStatus();

  console.log('[Softcodes] Extension activated successfully');
}

async function checkAuthStatus() {
  const isAuth = await authService.isAuthenticated();
  
  if (!isAuth) {
    const result = await vscode.window.showInformationMessage(
      'Softcodes.ai: Please authenticate to use the extension',
      'Authenticate',
      'Later'
    );
    
    if (result === 'Authenticate') {
      vscode.commands.executeCommand('softcodes.authenticate');
    }
  } else {
    console.log('[Softcodes] User is authenticated');
  }
}

export function deactivate() {
  console.log('[Softcodes] Extension deactivated');
}
```

### 5. Update package.json

**File:** `package.json`

Add these sections:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "softcodes.authenticate",
        "title": "Softcodes: Authenticate",
        "category": "Softcodes"
      },
      {
        "command": "softcodes.signOut",
        "title": "Softcodes: Sign Out",
        "category": "Softcodes"
      },
      {
        "command": "softcodes.refreshToken",
        "title": "Softcodes: Refresh Token",
        "category": "Softcodes"
      },
      {
        "command": "softcodes.viewStatus",
        "title": "Softcodes: View Authentication Status",
        "category": "Softcodes"
      }
    ],
    "configuration": {
      "title": "Softcodes.ai",
      "properties": {
        "softcodes.apiBaseUrl": {
          "type": "string",
          "default": "https://www.softcodes.ai/api/extension",
          "description": "API base URL for Softcodes.ai"
        },
        "softcodes.autoRefresh": {
          "type": "boolean",
          "default": true,
          "description": "Automatically refresh authentication tokens before expiry"
        }
      }
    }
  }
}
```

---

## Testing

### Manual Testing Steps

1. **Install and Activate Extension**
   ```bash
   npm install
   npm run compile
   # Press F5 to launch Extension Development Host
   ```

2. **Test Authentication**
   - Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
   - Run "Softcodes: Authenticate"
   - Paste access token from dashboard
   - Paste refresh token when prompted
   - Verify success message

3. **Test Auto-Refresh**
   - Wait until 1 day before token expiry
   - Or manually trigger: "Softcodes: Refresh Token"
   - Verify new token is stored

4. **Test API Calls**
   - Use the API service to make requests
   - Verify 401 triggers automatic refresh and retry

5. **Test Sign Out**
   - Run "Softcodes: Sign Out"
   - Verify tokens are cleared
   - Verify prompted to authenticate again

### Unit Tests

Create test files in `src/test/`:

```typescript
// src/test/tokenStorage.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';
import { TokenStorageService } from '../services/tokenStorage';

suite('TokenStorageService Test Suite', () => {
  test('Should store and retrieve tokens', async () => {
    const context = {} as vscode.ExtensionContext;
    const storage = new TokenStorageService(context);
    
    await storage.storeTokens('access', 'refresh', '2025-01-01', 'session-id');
    const token = await storage.getAccessToken();
    
    assert.strictEqual(token, 'access');
  });
});
```

---

## Troubleshooting

### Common Issues

#### 1. "Invalid token format" Error

**Problem:** Token doesn't have 3 parts separated by dots.

**Solution:** 
- Ensure you're copying the complete token from the dashboard
- Token should look like: `eyJhbGc...xxxxx.eyJzdWI...xxxxx.signature...xxxxx`

#### 2. "Token validation failed" Error

**Problem:** Backend rejects the token.

**Solution:**
- Generate a new token from the dashboard
- Ensure backend is running and accessible
- Check network connectivity

#### 3. "Refresh token is required" Error

**Problem:** Extension needs refresh token for auto-renewal.

**Solution:**
- Copy both access token and refresh token from dashboard
- Dashboard should display both tokens after generation

#### 4. Auto-Refresh Not Working

**Problem:** Token expires without auto-refresh.

**Solution:**
- Check extension logs: Help → Toggle Developer Tools → Console
- Verify `softcodes.autoRefresh` setting is enabled
- Manually refresh: "Softcodes: Refresh Token"

#### 5. API Calls Failing with 401

**Problem:** Backend returns unauthorized despite having token.

**Solution:**
- Check if token is expired: "Softcodes: View Authentication Status"
- Verify backend endpoint is correct
- Check API base URL in settings

### Debug Logging

Enable detailed logging by adding to your settings:

```json
{
  "softcodes.debug": true
}
```

Check logs:
- VSCode: Help → Toggle Developer Tools → Console
- Look for `[Softcodes]` prefix messages

---

## User Guide

### How to Authenticate

1. **Generate Token from Dashboard**
   - Go to https://www.softcodes.ai/dashboard
   - Click "Generate Extension Token"
   - Copy both the Access Token and Refresh Token

2. **Authenticate in VSCode**
   - Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
   - Type "Softcodes: Authenticate"
   - Paste the Access Token
   - Paste the Refresh Token when prompted

3. **Verify Authentication**
   - Run "Softcodes: View Authentication Status"
   - Should show expiry date and days remaining

### How to Use Features

Once authenticated, all Softcodes.ai features work automatically:
- Code completions
- AI assistance
- Refactoring suggestions
- etc.

### How to Sign Out

1. Open Command Palette
2. Type "Softcodes: Sign Out"
3. Confirm when prompted

---

## Security Best Practices

1. **Never Log Full Tokens**
   - Only log first/last few characters
   - Use `token.substring(0, 10) + '...'` for debugging

2. **Use SecretStorage**
   - Always use `context.secrets.store()` for tokens
   - Never use `globalState` or `workspace` storage for sensitive data

3. **Validate Token Format**
   - Check JWT structure before making API calls
   - Verify token type (access vs refresh)

4. **Handle Errors Gracefully**
   - Don't expose sensitive error details to users
   - Log detailed errors to console for debugging

5. **Clear Tokens on Errors**
   - Clear invalid/expired tokens immediately
   - Prompt user to re-authenticate

---

## Deployment Checklist

- [ ] All service files created
- [ ] Dependencies installed
- [ ] Commands registered in package.json
- [ ] Extension tested locally
- [ ] Token storage works correctly
- [ ] Auto-refresh works correctly
- [ ] API calls work with retry logic
- [ ] Error handling tested
- [ ] User documentation updated
- [ ] Extension packaged: `vsce package`
- [ ] Extension published: `vsce publish`

---

## Support

For issues or questions:
- Check the troubleshooting section
- Review console logs for `[Softcodes]` messages
- Contact support@softcodes.ai
- Visit https://docs.softcodes.ai

---

## Changelog

### Version 1.0.0
- Initial JWT authentication implementation
- Auto-refresh token support
- Secure token storage
- API request service with retry logic
- User authentication commands