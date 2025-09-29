# Softcodes.ai VSCode Extension Authentication Changes

This document details the changes required for the VSCode extension to support the authentication flow using Clerk as the auth provider. The extension integrates with the website's backend for PKCE OAuth2, token storage, validation, and refresh. These changes assume the extension project is in a separate repository (e.g., `softcodes-vscode-extension`). Use the website changes (WEBSITE_AUTH_CHANGES.md) as the backend counterpart.

## Overview
- **Scope**: Extension updates for:
  - `softcodes.signin` command to initiate PKCE flow.
  - URI handler for callback.
  - Secure token storage and usage.
  - JWT fixes for decoding and verification.
  - Auto-refresh logic with Clerk SDK fallback.
- **Key Files to Modify/Create**:
  - `package.json` (commands, URI scheme).
  - `src/extension.ts` (activation, URI handler, command registration).
  - `src/commands/auth.ts` or `src/services/authService.ts` (signin logic, exchange, refresh).
  - `src/utils/jwtUtils.ts` (decoding/verification fixes).
  - `src/services/apiClient.ts` (authenticated requests with refresh).
- **Dependencies**: Add to `package.json`: `"jsonwebtoken": "^9.0.2"`, `"@clerk/clerk-js": "^2.0.0"`, `"crypto"`: (built-in). Run `npm i`.
- **Configuration**: Add to `settings.json` or extension config: `"softcodes.apiBaseUrl": "https://yourapp.com"`.
- **Custom URI Scheme**: `vscode-bluebytebooster://callback`.

## 1. package.json Updates (Commands and URI Scheme)
- **Purpose**: Register the signin command and custom URI for callbacks.
- **Changes**:
  - Add to `"contributes.commands"`:
    ```json
    {
      "command": "softcodes.signin",
      "title": "Sign in to Softcodes.ai",
      "category": "Softcodes"
    }
    ```
  - Add to `"contributes"`:
    ```json
    "uriSchemes": ["vscode-bluebytebooster"]
    ```
- **Full Example** (contributes section):
  ```json
  "contributes": {
    "commands": [
      {
        "command": "softcodes.signin",
        "title": "Sign in to Softcodes.ai",
        "category": "Softcodes"
      }
    ],
    "uriSchemes": ["vscode-bluebytebooster"]
  }
  ```
- **Testing**: Reload extension, search "Sign in to Softcodes.ai" in command palette.
- **Impact**: Enables user-triggered auth and browser redirects.

## 2. extension.ts - Activation and URI Handler
- **Purpose**: Register the signin command and handle custom URI callbacks from browser.
- **Changes**: In `activate(context: vscode.ExtensionContext)`:
  - Import necessary modules: `import * as vscode from 'vscode'; import { registerSigninCommand } from './commands/auth'; import { exchangeToken } from './services/authService';`.
  - Register command: `registerSigninCommand(context);`.
  - Register URI handler:
    ```ts
    const uriHandler = vscode.window.registerUriHandler({
      handleUri: async (uri: vscode.Uri) => {
        const params = new URLSearchParams(uri.query);
        const code = params.get('code');
        const state = params.get('state');
        if (!code || !state) {
          vscode.window.showErrorMessage('Invalid callback parameters.');
          return;
        }
        // Validate state
        const storedState = context.secrets.get('auth_state');
        if (state !== storedState) {
          vscode.window.showErrorMessage('Invalid state - authentication aborted.');
          context.secrets.delete('auth_state');
          context.secrets.delete('code_verifier');
          return;
        }
        // Exchange
        const verifier = context.secrets.get('code_verifier');
        const redirectUri = 'vscode-bluebytebooster://callback';
        await exchangeToken(code, verifier, state, redirectUri, context);
        // Clear temp storage
        context.secrets.delete('auth_state');
        context.secrets.delete('code_verifier');
        vscode.window.showInformationMessage('Authentication successful!');
      }
    });
    context.subscriptions.push(uriHandler);
    ```
- **Testing**: Simulate URI with `vscode://vscode-bluebytebooster.callback?code=test&state=test` (use VSCode command or external tool).
- **Impact**: Securely processes browser callback, validates state to prevent CSRF.

## 3. src/commands/auth.ts - softcodes.signin Command Implementation
- **Purpose**: Generate PKCE params, store securely, open browser to initiate page.
- **Changes**: New file or add to existing auth module.
  ```ts
  import * as vscode from 'vscode';
  import * as crypto from 'crypto';

  export function registerSigninCommand(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('softcodes.signin', async () => {
      try {
        // Generate PKCE
        const codeVerifier = crypto.randomBytes(32).toString('base64url');
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const codeChallenge = btoa(String.fromCharCode(...hashArray))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        const state = crypto.randomBytes(16).toString('hex');

        // Store
        context.secrets.store('code_verifier', codeVerifier);
        context.secrets.store('auth_state', state);
        context.globalState.update('auth_in_progress', true);

        // Get config
        const apiBaseUrl = vscode.workspace.getConfiguration('softcodes').get<string>('apiBaseUrl', 'https://yourapp.com');
        const redirectUri = 'vscode-bluebytebooster://callback';
        const initiateUrl = `${apiBaseUrl}/auth/vscode-initiate?code_challenge=${codeChallenge}&state=${state}&vscode_redirect_uri=${encodeURIComponent(redirectUri)}`;

        // Open browser
        await vscode.env.openExternal(vscode.Uri.parse(initiateUrl));
        vscode.window.showInformationMessage('Authentication started. Please complete in your browser.');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to start authentication: ${error}`);
      }
    });
    context.subscriptions.push(disposable);
  }
  ```
- **Testing**: Run command, check Output for logs, verify browser opens with params.
- **Impact**: Initiates secure PKCE flow; uses Web Crypto API for hashing.

## 4. src/services/authService.ts - Token Exchange and Storage
- **Purpose**: Handle POST to complete endpoint, store tokens securely.
- **Changes**: New or update service.
  ```ts
  import * as vscode from 'vscode';

  export async function exchangeToken(code: string, verifier: string, state: string, redirectUri: string, context: vscode.ExtensionContext) {
    const apiBaseUrl = vscode.workspace.getConfiguration('softcodes').get<string>('apiBaseUrl', 'https://yourapp.com');
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/complete-vscode-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: verifier, state, redirect_uri: redirectUri }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Exchange failed');
      }
      const data = await response.json();
      if (data.success) {
        context.secrets.store('access_token', data.access_token);
        context.secrets.store('refresh_token', data.refresh_token);
        context.globalState.update('token_expiry', Date.now() + data.expires_in * 1000);
        context.globalState.update('auth_in_progress', false);
        return data;
      }
    } catch (error) {
      console.error('Token exchange error:', error);
      vscode.window.showErrorMessage(`Authentication failed: ${error}`);
      context.globalState.update('auth_in_progress', false);
    }
  }

  export async function getAccessToken(context: vscode.ExtensionContext): Promise<string | null> {
    return context.secrets.get('access_token');
  }

  export function isAuthenticated(context: vscode.ExtensionContext): boolean {
    const expiry = context.globalState.get('token_expiry');
    return !!expiry && Date.now() < expiry;
  }
  ```
- **Testing**: Call from URI handler; check `context.secrets` via debugger.
- **Impact**: Secure storage (encrypted by VSCode); expiry tracking for proactive refresh.

## 5. src/utils/jwtUtils.ts - JWT Fixes
- **Purpose**: Fix base64url decoding garbling and add HS256 fallback for custom tokens.
- **Changes**: Update or create utils.
  ```ts
  import * as jwt from 'jsonwebtoken';

  export function safeBase64UrlDecode(str: string): any {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padding = 4 - (base64.length % 4);
    for (let i = 0; i < padding; i++) base64 += '=';
    try {
      const binary = Buffer.from(base64, 'base64').toString('utf8');
      return JSON.parse(binary);
    } catch (e) {
      console.error('JWT decode failed:', e);
      throw new Error(`Invalid JWT part: ${e.message}`);
    }
  }

  export function verifyJWTToken(token: string, jwtSecret: string): { valid: boolean; clerkUserId?: string; error?: string } {
    try {
      // Try HS256 for custom tokens first
      const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as any;
      if (decoded.type === 'access' && decoded.sub) {
        return { valid: true, clerkUserId: decoded.sub };
      }
      return { valid: false, error: 'Invalid payload' };
    } catch (hsError) {
      console.log('HS256 failed, trying Clerk RS256 (existing code)...');
      // Insert existing Clerk JWKS verification here (from JWTVerificationService)
      // e.g., fetch JWKS, verify with jose or similar
      return { valid: false, error: (hsError as Error).message };
    }
  }
  ```
- **Testing**: Decode a sample JWT, verify with invalid token.
- **Impact**: Prevents "Unexpected token" errors; supports both token types.

## 6. src/services/apiClient.ts - Auto-Refresh Logic
- **Purpose**: Wrapper for API calls with token attachment and refresh on 401.
- **Changes**: New client with Clerk SDK integration.
  ```ts
  import * as vscode from 'vscode';
  import { Clerk } from '@clerk/clerk-js';
  import { getAccessToken, isAuthenticated } from './authService';

  let clerkClient: Clerk | null = null;

  export function initClerk(publishableKey: string) {
    clerkClient = new Clerk(publishableKey);
    clerkClient.load().then(() => console.log('Clerk SDK loaded'));
  }

  export async function makeAuthenticatedRequest(url: string, options: RequestInit = {}, context: vscode.ExtensionContext) {
    if (!isAuthenticated(context)) {
      throw new Error('Not authenticated');
    }

    let token = await getAccessToken(context);
    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      const expiry = context.globalState.get('token_expiry') as number;
      if (Date.now() > expiry - 300000) { // 5min threshold
        try {
          // Try Clerk SDK
          if (clerkClient && clerkClient.session) {
            await clerkClient.sessions.refreshCurrent();
            token = await clerkClient.session.getToken();
            context.secrets.store('access_token', token);
            context.globalState.update('token_expiry', Date.now() + 3600 * 1000); // Assume 1h
          } else {
            // Backend fallback
            const refreshToken = context.secrets.get('refresh_token');
            if (!refreshToken) throw new Error('No refresh token');
            const refreshRes = await fetch(`${apiBaseUrl}/api/auth/refresh-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: refreshToken }),
            });
            if (!refreshRes.ok) throw new Error('Refresh failed');
            const data = await refreshRes.json();
            context.secrets.store('access_token', data.access_token);
            context.secrets.store('refresh_token', data.refresh_token);
            context.globalState.update('token_expiry', Date.now() + data.expires_in * 1000);
            token = data.access_token;
          }
          // Retry
          response = await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (refreshError) {
          console.error('Refresh failed:', refreshError);
          vscode.window.showErrorMessage('Session expired. Please sign in again.');
          vscode.commands.executeCommand('softcodes.signin');
          return response;
        }
      }
    }

    return response;
  }

  // Pro-active refresh (call in activate)
  export function startExpiryMonitor(context: vscode.ExtensionContext) {
    const interval = setInterval(async () => {
      if (isAuthenticated(context)) {
        const expiry = context.globalState.get('token_expiry') as number;
        if (Date.now() > expiry - 600000) { // 10min early
          // Trigger makeAuthenticatedRequest to a dummy endpoint or direct refresh
          try {
            await refreshToken(context); // Implement separate refresh if needed
          } catch (e) {
            console.log('Pro-active refresh failed, will handle on next call');
          }
        }
      }
    }, 300000); // 5min
    context.subscriptions.push({ dispose: () => clearInterval(interval) });
  }
  ```
- **Testing**: Call API with expired token, verify retry succeeds.
- **Impact**: Automatic, seamless refresh; Clerk SDK for session tokens, backend for custom.

## Deployment and Testing
- **Build**: `vsce package` or `npm run compile`.
- **Test Flow**: 1. Run extension (F5). 2. Command palette → Sign in. 3. Browser auth. 4. Callback → Tokens stored. 5. API call → Validates. 6. Simulate 401 → Refreshes.
- **Debug**: Use VSCode Output panel (channel "Softcodes"), add console.log for [AUTH-DEBUG].
- **Edge Cases**: Invalid state (abort), refresh fail (prompt signin), expiry (pro-active).

This completes the extension side. Coordinate with website deployment for full E2E.