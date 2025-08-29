# VS Code Extension - Required Authentication Changes

To integrate with the new backend authentication flow, the VS Code extension must be updated to follow the complete PKCE OAuth 2.0 flow. The key changes are centered around initiating the login, handling the callback, and exchanging the authorization code for secure tokens.

## 1. Authentication Initiation

- **Action**: When the user triggers authentication, the extension must generate a cryptographically random `code_verifier` and a corresponding `code_challenge`.
- **Storage**: The `code_verifier` and a unique `state` parameter must be stored securely in the extension's local storage (`context.secrets`).
- **Browser Navigation**: The extension should open the user's browser to `/auth/vscode-initiate`, passing the `code_challenge`, `state`, and a `vscode_redirect_uri` as query parameters.

Example URL:
`https://your-app.com/auth/vscode-initiate?code_challenge=...&state=...&vscode_redirect_uri=vscode-bluebytebooster://callback`

## 2. Callback Handling

- **URI Handler**: The extension must have a URI handler registered for the `vscode-bluebytebooster://` scheme.
- **Parameter Parsing**: The handler will receive the `authorization_code` (which will be the Clerk User ID) and the `state` from the URL.
- **State Validation**: The received `state` must be validated against the one stored locally to prevent CSRF attacks.

## 3. Token Exchange

- **Action**: After validating the `state`, the extension must make a `POST` request to the backend's `/api/auth/token` endpoint.
- **Request Body**: The request must include:
  - `code`: The authorization code received in the callback.
  - `code_verifier`: The verifier retrieved from secure storage.
  - `state`: The unique state parameter.
  - `redirect_uri`: The original `vscode-bluebytebooster://callback` URI.
- **Response**: The backend will respond with an `access_token`, `refresh_token`, and `expires_in`.

## 4. Secure Token Storage

- **Action**: The received `access_token` and `refresh_token` must be stored securely using `context.secrets.store()`. Storing the token's expiry time is also recommended for proactive refreshing.

## 5. Authenticated API Calls

- **Header**: All subsequent API requests to the backend must include the `access_token` in the `Authorization` header.
- **Format**: `Authorization: Bearer <access_token>`

## 6. Token Refreshing

- **Trigger**: When an API call returns a `401 Unauthorized` error, the extension should initiate a token refresh.
- **Action**: Make a `POST` request to `/api/auth/refresh-token` with the stored `refresh_token`.
- **Update Storage**: If the refresh is successful, update the stored `access_token` and `refresh_token` with the new ones received from the backend.
- **Re-Authentication**: If the refresh fails, the user must be prompted to log in again.