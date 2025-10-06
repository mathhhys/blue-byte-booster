# VSCode Extension: Detailed Implementation Plan for Clerk Token Authentication

This document provides a comprehensive, step-by-step implementation guide for updating the Softcodes.ai VSCode extension to use Clerk-based token authentication with secure storage, verification, and automatic refresh. The plan assumes the backend changes (Dashboard token generation, middleware verification, refresh endpoint, and webhooks) are already implemented as per previous steps.

The new flow:
1. User authenticates via Clerk in the web dashboard.
2. Dashboard generates and displays a long-lived Clerk session token (RS256, 24h expiry via custom JWT template).
3. User copies the token and configures it in the VSCode extension settings.
4. Extension stores the token securely in VSCode Secret Storage.
5. Extension verifies the token using @clerk/backend (JWKS-based RS256 verification).
6. Extension uses the token for API calls to the backend.
7. On 401 errors (expiry/revocation), extension automatically refreshes via `/api/auth/refresh-token`.
8. If refresh fails, prompt user to re-authenticate via dashboard.

## Prerequisites
- **Dependencies**: Add to `package.json`:
  ```json
  {
    "dependencies": {
      "@clerk/backend": "^0.36.0",
      "jsonwebtoken": "^9.0.2"
    },
    "devDependencies": {
      "@types/jsonwebtoken": "^9.0.6"
    }
  }
  ```
  Run `npm install` or `yarn install`.
- **Environment**: Extension runs in VSCode (Node.js environment). Ensure `CLERK_PUBLISHABLE_KEY` is available via extension config (user sets it or fetch from backend).
- **Existing Structure**: Assume the extension has:
  - `src/extension.ts` (activation).
  - `src/auth/` directory for auth logic.
  - `src/api/` for backend calls.
  - Settings via `vscode.workspace.getConfiguration('softcodes')`.
- **Testing**: Use VSCode's Extension Development Host. Mock Clerk JWKS for unit tests.

## Phase 1: Extension Configuration and Token Storage (Item 8)
### 1.1 Add Extension Settings
Update `package.json` to add configuration schema for token input.

**File**: `package.json`
```json
{
  "contributes": {
    "configuration": {
      "title": "Softcodes.ai",
      "properties": {
        "softcodes.clerkToken": {
          "type": "string",
          "default": "",
          "description": "Clerk authentication token for Softcodes.ai API access. Generate from dashboard.",
          "scope": "application"
        },
        "softcodes.apiBaseUrl": {
          "type": "string",
          "default": "https://www.softcodes.ai/api",
          "description": "Base URL for Softcodes.ai backend API."
        }
      }
    },
    "commands": [
      {
        "command": "softcodes.authenticate",
        "title": "Softcodes: Authenticate",
        "category": "Softcodes"
      },
      {
        "command": "softcodes.reauthenticate",
        "title": "Softcodes: Re-authenticate (Clear Token)",
        "category": "Softcodes"
      }
    ]
  }
}
```

### 1.2 Implement Secret Storage Service
Create a service to handle secure token storage/retrieval using VSCode's `SecretStorage`.

**File**: `src/services/SecretStorageService.ts`
```typescript
import * as vscode from 'vscode';

export class SecretStorageService {
  private context: vscode.ExtensionContext;
  private readonly TOKEN_KEY = 'softcodes.clerkToken';
  private readonly REFRESH_TOKEN_KEY = 'softcodes.refreshToken';
  private readonly TOKEN_EXPIRY_KEY = 'softcodes.tokenExpiry';

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async storeToken(token: string, refreshToken?: string, expiry?: number): Promise<void> {
    await this.context.secrets.store(this.TOKEN_KEY, token);
    if (refreshToken) {
      await this.context.secrets.store(this.REFRESH_TOKEN_KEY, refreshToken);
    }
    if (expiry) {
      await this.context.globalState.update(this.TOKEN_EXPIRY_KEY, expiry);
    }
    console.log('[SecretStorage] Token stored securely');
  }

  async getToken(): Promise<string | undefined> {
    return this.context.secrets.get(this.TOKEN_KEY);
  }

  async getRefreshToken(): Promise<string | undefined> {
    return this.context.secrets.get(this.REFRESH_TOKEN_KEY);
  }

  async getTokenExpiry(): Promise<number | undefined> {
    return this.context.globalState.get(this.TOKEN_EXPIRY_KEY);
  }

  async clearTokens(): Promise<void> {
    await this.context.secrets.delete(this.TOKEN_KEY);
    await this.context.secrets.delete(this.REFRESH_TOKEN_KEY);
    await this.context.globalState.update(this.TOKEN_EXPIRY_KEY, undefined);
    console.log('[SecretStorage] Tokens cleared');
  }

  async isTokenExpiringSoon(thresholdMinutes = 5): Promise<boolean> {
    const expiry = await this.getTokenExpiry();
    if (!expiry) return true;
    const now = Date.now();
    return (expiry - now) < (thresholdMinutes * 60 * 1000);
  }
}
```

### 1.3 Update Extension Activation
Initialize the storage service and register commands.

**File**: `src/extension.ts`
```typescript
import * as vscode from 'vscode';
import { SecretStorageService } from './services/SecretStorageService';
import { AuthService } from './services/AuthService';
import { ApiService } from './services/ApiService';

let secretStorage: SecretStorageService | undefined;
let authService: AuthService | undefined;
let apiService: ApiService | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Softcodes.ai extension activated');

  secretStorage = new SecretStorageService(context);
  authService = new AuthService(secretStorage);
  apiService = new ApiService(secretStorage, authService);

  // Register commands
  const authenticateDisposable = vscode.commands.registerCommand('softcodes.authenticate', async () => {
    await authService?.promptAndStoreToken();
  });

  const reauthDisposable = vscode.commands.registerCommand('softcodes.reauthenticate', async () => {
    await authService?.clearTokensAndPrompt();
  });

  context.subscriptions.push(authenticateDisposable, reauthDisposable);

  // Check token on startup
  authService?.checkTokenStatus();
}

export function deactivate() {
  console.log('Softcodes.ai extension deactivated');
}
```

## Phase 2: Token Verification (Item 9)
### 2.1 Create Auth Service
Handle verification using @clerk/backend.

**File**: `src/services/AuthService.ts`
```typescript
import * as vscode from 'vscode';
import { verifyToken } from '@clerk/backend';
import { SecretStorageService } from './SecretStorageService';
import { ApiService } from './ApiService';

export class AuthService {
  private secretStorage: SecretStorageService;
  private apiService: ApiService;
  private readonly CLERK_ISSUER = 'https://your-clerk-instance.clerk.dev';  // Replace with actual

  constructor(secretStorage: SecretStorageService, apiService: ApiService) {
    this.secretStorage = secretStorage;
    this.apiService = apiService;
  }

  async verifyToken(token: string): Promise<{ valid: boolean; userId?: string; error?: string }> {
    try {
      const claims = await verifyToken(token, {
        issuer: this.CLERK_ISSUER,
        apiKey: vscode.workspace.getConfiguration('softcodes').get('clerkPublishableKey') as string  // Or fetch from config
      });

      if (!claims.sub) {
        throw new Error('Missing user ID in token claims');
      }

      console.log('[Auth] Token verified successfully for user:', claims.sub);
      return { valid: true, userId: claims.sub };
    } catch (error) {
      console.error('[Auth] Token verification failed:', error);
      return { valid: false, error: (error as Error).message };
    }
  }

  async getValidToken(): Promise<string | null> {
    const token = await this.secretStorage.getToken();
    if (!token) return null;

    const verification = await this.verifyToken(token);
    if (verification.valid) {
      return token;
    }

    // Token invalid, try refresh
    return await this.refreshTokenIfNeeded();
  }

  private async refreshTokenIfNeeded(): Promise<string | null> {
    const refreshToken = await this.secretStorage.getRefreshToken();
    if (!refreshToken) return null;

    const response = await this.apiService.refreshToken(refreshToken);
    if (response.success && response.access_token) {
      await this.secretStorage.storeToken(response.access_token, response.refresh_token, Date.now() + response.expires_in * 1000);
      return response.access_token;
    }

    return null;
  }

  async promptAndStoreToken(): Promise<void> {
    const token = await vscode.window.showInputBox({
      prompt: 'Enter your Clerk token from the Softcodes.ai dashboard',
      placeHolder: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
      ignoreFocusOut: true,
      password: true  // Hide input for security
    });

    if (!token) return;

    const verification = await this.verifyToken(token);
    if (!verification.valid) {
      vscode.window.showErrorMessage(`Token verification failed: ${verification.error}`);
      return;
    }

    // Assume refresh token is not needed initially; backend can provide on first API call if required
    await this.secretStorage.storeToken(token, undefined, Date.now() + 24 * 60 * 60 * 1000);  // Assume 24h
    vscode.window.showInformationMessage('Token stored successfully! Extension is now authenticated.');
  }

  async clearTokensAndPrompt(): Promise<void> {
    await this.secretStorage.clearTokens();
    vscode.window.showInformationMessage('Tokens cleared. Please re-authenticate.');
    await this.promptAndStoreToken();
  }

  async checkTokenStatus(): Promise<void> {
    const token = await this.getValidToken();
    if (!token) {
      vscode.window.showWarningMessage('Softcodes.ai: No valid token found. Run "Softcodes: Authenticate" to set up.');
    } else {
      console.log('[Auth] Valid token loaded on startup');
    }
  }
}
```

### 2.2 Handle Token Expiry Proactively
Add a status bar item to show auth status and refresh proactively.

**File**: `src/extension.ts` (add to activate)
```typescript
// Status bar item
const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
statusBar.command = 'softcodes.authenticate';
statusBar.text = '$(lock) Softcodes: Not Authenticated';
statusBar.tooltip = 'Click to authenticate';
statusBar.show();

context.subscriptions.push(statusBar);

// Update status on token change (listen to config or use event)
authService?.onTokenChange((isAuthenticated) => {
  statusBar.text = isAuthenticated ? '$(unlock) Softcodes: Authenticated' : '$(lock) Softcodes: Not Authenticated';
});
```

In AuthService, add event emitter for token status changes.

## Phase 3: API Service with Auth (Items 10-11)
### 3.1 Create API Service
Handle API calls with automatic auth and refresh.

**File**: `src/services/ApiService.ts`
```typescript
import * as vscode from 'vscode';
import { SecretStorageService } from './SecretStorageService';
import { AuthService } from './AuthService';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ApiService {
  private secretStorage: SecretStorageService;
  private authService: AuthService;
  private baseUrl: string;

  constructor(secretStorage: SecretStorageService, authService: AuthService) {
    this.secretStorage = secretStorage;
    this.authService = authService;
    this.baseUrl = vscode.workspace.getConfiguration('softcodes').get('apiBaseUrl', 'https://www.softcodes.ai/api') as string;
  }

  private async getAuthHeader(): Promise<{ Authorization: string } | null> {
    const token = await this.authService.getValidToken();
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }

  async makeAuthenticatedRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const headers = await this.getAuthHeader();
    if (!headers) {
      return { success: false, error: 'Not authenticated. Please authenticate first.' };
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
          ...options.headers
        }
      });

      if (response.status === 401) {
        // Token invalid, try refresh
        const refreshedToken = await this.authService.refreshTokenIfNeeded();
        if (refreshedToken) {
          // Retry with new token
          const retryHeaders = { Authorization: `Bearer ${refreshedToken}` };
          const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              ...retryHeaders,
              ...options.headers
            }
          });

          if (retryResponse.ok) {
            const data = await retryResponse.json();
            return { success: true, data };
          }
        }

        // Refresh failed, prompt re-auth
        vscode.window.showErrorMessage('Authentication expired. Please re-authenticate.', 'Re-authenticate').then(selection => {
          if (selection === 'Re-authenticate') {
            vscode.commands.executeCommand('softcodes.reauthenticate');
          }
        });
        return { success: false, error: 'Authentication expired. Please re-authenticate.' };
      }

      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || `HTTP ${response.status}` };
      }
    } catch (error) {
      console.error('[API] Request failed:', error);
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<{ access_token: string; refresh_token?: string; expires_in: number }>> {
    return this.makeAuthenticatedRequest('/auth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ token: refreshToken })  // Send refresh token as 'token' per endpoint
    });
  }

  // Example API call: Get user credits
  async getUserCredits(): Promise<ApiResponse<{ credits: number }>> {
    return this.makeAuthenticatedRequest<{ credits: number }>('/user/credits');
  }

  // Add more methods for other endpoints (e.g., model inference, usage tracking)
}
```

### 3.2 Integrate with Extension Features
Update existing extension commands to use the API service.

**Example**: For a command that uses credits:
```typescript
// In extension.ts or command handler
const api = new ApiService(secretStorage, authService);
const result = await api.getUserCredits();
if (result.success) {
  vscode.window.showInformationMessage(`You have ${result.data.credits} credits remaining.`);
} else {
  vscode.window.showErrorMessage(result.error || 'Failed to fetch credits');
}
```

## Phase 4: Error Handling and UX (Item 11)
- **401 Handling**: Already in `makeAuthenticatedRequest` – auto-refresh, then prompt if fails.
- **Network Errors**: Show VSCode notifications with retry options.
- **Token Expiry Warnings**: Use `secretStorage.isTokenExpiringSoon()` in a timer (every 5min) to warn user.
- **Logging**: Use `console.log` for debug; integrate with VSCode Output Channel for production logs.

**Add Output Channel**:
```typescript
// In extension.ts
const outputChannel = vscode.window.createOutputChannel('Softcodes.ai');
outputChannel.appendLine('Extension loaded');
```

Replace `console.log` with `outputChannel.appendLine` where appropriate.

## Phase 5: Testing Strategy
### 5.1 Unit Tests
Use `vscode-test` and Jest/Mocha.
- Test `verifyToken`: Mock `@clerk/backend` with valid/invalid tokens.
- Test storage: Mock `SecretStorage`.
- Test refresh: Mock API responses.

**Example Test** (`test/auth.test.ts`):
```typescript
import { verifyToken } from '@clerk/backend';
// Mock verifyToken
jest.mock('@clerk/backend');

test('verifyToken returns valid for correct token', async () => {
  (verifyToken as jest.Mock).mockResolvedValue({ sub: 'user_123' });
  const result = await authService.verifyToken('valid.token');
  expect(result.valid).toBe(true);
  expect(result.userId).toBe('user_123');
});
```

### 5.2 Integration Tests
- Launch Extension Development Host.
- Generate token from dashboard.
- Set token via settings.
- Trigger API calls, simulate 401, verify refresh.
- Test revocation: Use Clerk dashboard to revoke session, verify extension prompts re-auth.

### 5.3 E2E Tests
- Use `vscode-extension-tester` for UI automation.
- Automate: Open settings, paste token, run command, check status bar.

## Phase 6: Deployment and Documentation
- **Publish**: Update `CHANGELOG.md`, bump version, `vsce package`, publish to Marketplace.
- **User Guide**: Update README.md with:
  - Setup steps: Install, authenticate command, paste token.
  - Token refresh: "Tokens auto-refresh; re-auth if prompted."
  - Troubleshooting: "If 401 persists, regenerate token from dashboard."
- **Security Notes**: Tokens stored encrypted; no logging of full tokens.

## Estimated Timeline
- Phase 1: 2-3 hours
- Phase 2: 3-4 hours
- Phase 3: 4-5 hours
- Testing: 3 hours
- Total: 12-15 hours

## Potential Challenges
- **JWKS Fetch**: Handle network errors in verification; fallback to API validation.
- **Secret Key**: Extension can't use secret key; rely on public JWKS or backend validation for sensitive ops.
- **Offline Mode**: No verification without internet; cache user ID after first verify.
- **VSCode Compatibility**: Test on Windows/macOS/Linux.

Implement in order, test each phase. After completion, integrate with existing features (e.g., code completion using API).