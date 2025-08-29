# VSCode Extension Authentication Implementation Plan

This document outlines the detailed steps for implementing the OAuth 2.0 PKCE authentication flow within the VSCode extension.

## 1. Register Custom URI Scheme in `package.json`

-   **Action:** Add a `uriSchemes` contribution to the extension's `package.json`.
-   **Scheme:** `vscode-bluebytebooster`
-   **Command:** Define a command `bluebytebooster.authenticate` to trigger the authentication flow.

```json
{
  "name": "blue-byte-booster",
  "contributes": {
    "uriSchemes": [
      "vscode-bluebytebooster"
    ],
    "commands": [
      {
        "command": "bluebytebooster.authenticate",
        "title": "Authenticate with Blue Byte Booster"
      }
    ]
  }
}
```

## 2. Implement Logic to Open Browser to `/auth/vscode-initiate`

-   **Action:** Create a function to initiate the authentication flow.
-   **Steps:**
    1.  Generate a cryptographically random `code_verifier`.
    2.  Derive `code_challenge` from `code_verifier` (SHA256 + Base64-URL).
    3.  Generate a random `state` parameter for CSRF protection.
    4.  Construct the `redirect_uri`: `vscode-bluebytebooster://callback`.
    5.  Open the user's browser to `/auth/vscode-initiate` with `code_challenge`, `state`, and `vscode_redirect_uri` as query parameters.
    6.  **Crucially:** Store `code_verifier` and `state` in `context.secrets` or `context.globalState`.

## 3. Implement Logic to Handle Custom URI Callback

-   **Action:** Register a URI handler in the extension's `activate` function.
-   **Handler Logic:**
    1.  Parse the incoming URI to extract `authorization_code` and `state`.
    2.  Validate the received `state` against the stored `state` to prevent CSRF.

```typescript
// In extension.ts
export function activate(context: vscode.ExtensionContext) {
  vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri) {
      // 1. Parse URI for authorization_code and state
      // 2. Validate state
    }
  });
}
```

## 4. Implement Logic to Exchange Code for Tokens

-   **Action:** Make a POST request to `/api/auth/token` from the VSCode extension.
-   **Request Body:**
    -   `authorization_code`
    -   `code_verifier` (retrieved from secure storage)
    -   `state`
    -   `redirect_uri`
-   **Response:** `access_token` and `refresh_token`.

## 5. Securely Store Tokens

-   **Action:** Use `context.secrets.store()` to save the `access_token` and `refresh_token`.
-   **Optional:** Store the access token's expiry time in `context.globalState` for proactive refreshing.

## 6. Use `access_token` for Authenticated API Calls

-   **Action:** Include the `access_token` in the `Authorization` header for all API requests.
-   **Header:** `Authorization: Bearer <access_token>`

## 7. Implement Refresh Token Logic

-   **Action:** Handle `401 Unauthorized` responses from the API.
-   **Steps:**
    1.  Retrieve the `refresh_token` from secure storage.
    2.  Make a POST request to `/api/auth/refresh-token` with the `refresh_token`.
    3.  If successful, update the stored `access_token` and `refresh_token`.
    4.  If unsuccessful, prompt the user to re-authenticate.

## Mermaid Diagram: Authentication Flow

```mermaid
sequenceDiagram
    participant VSCode Extension
    participant Browser
    participant Backend

    VSCode Extension->>Browser: Opens /auth/vscode-initiate?code_challenge=...&state=...
    Browser->>Backend: User authenticates
    Backend->>Browser: Redirect to vscode-bluebytebooster://callback?authorization_code=...&state=...
    Browser->>VSCode Extension: Triggers URI Handler with auth code
    VSCode Extension->>Backend: POST /api/auth/token with auth code and code_verifier
    Backend-->>VSCode Extension: Returns access_token and refresh_token
    VSCode Extension->>Backend: API call with access_token
    Backend-->>VSCode Extension: API response