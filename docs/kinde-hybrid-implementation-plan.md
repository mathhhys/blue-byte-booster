# Kinde Hybrid B2B Implementation Plan

## Overview
This document outlines the plan to implement a hybrid authentication and billing system.
- **Individual Users:** Continue using **Clerk** + **Stripe**.
- **Teams/Organizations:** Introduce **Kinde** + **Stripe** for seat-based pricing.

## Architecture

### 1. Frontend (Dual Provider Strategy)
The application will support two authentication providers simultaneously.

- **Root Provider:** The app is currently wrapped in `ClerkProvider`.
- **Route-Based Provider:** We will create a dedicated route section (e.g., `/teams/*` or `/dashboard/organization/*`) that is wrapped in `KindeProvider`.
- **Shared Components:** Components like `Navigation`, `Sidebar`, and `Profile` must be refactored to accept a generic "User" interface that can be populated by either Clerk or Kinde hooks.

**Tasks:**
- [ ] Install `@kinde-oss/kinde-auth-react`.
- [ ] Create `KindeAuthWrapper` component.
- [ ] Implement `/teams/login` and `/teams/register` pages.
- [ ] Refactor `useCurrentUser` hook to return a normalized user object from either provider.

### 2. Backend (Unified Middleware)
The API must validate tokens from both providers.

**Tasks:**
- [ ] Update `api/middleware/token-validation.js`.
- [ ] Implement logic to inspect the JWT Issuer (`iss`) claim.
  - If `iss` is Clerk -> Validate with Clerk SDK.
  - If `iss` is Kinde -> Validate with Kinde SDK (JWKS).
- [ ] Normalize `req.user` object:
  - `id`: Provider-specific ID.
  - `provider`: 'clerk' | 'kinde'.
  - `orgId`: Clerk Org ID or Kinde Org Code.

### 3. Database (Supabase)
Ensure the database can handle users from multiple sources.

**Tasks:**
- [ ] Review `users` table. Ensure `id` is not strictly tied to Clerk's ID format (though both are usually strings).
- [ ] Add `auth_provider` column to `users` table (default 'clerk').
- [ ] Update RLS policies to check for `auth_uid()` which matches the token subject.

### 4. Seat-Based Pricing Implementation
We will use Kinde Organizations to manage membership and Stripe for billing.

**Workflow:**
1.  **Organization Creation:** User signs up via Kinde -> Creates Kinde Org.
2.  **Subscription:** User purchases a "Team Plan" via Stripe (using our existing Stripe integration, but linked to Kinde Org ID).
3.  **Seat Provisioning:**
    - We store `total_seats` in Supabase `organization_subscriptions`.
    - When a user tries to invite a member in Kinde, we verify `current_members < total_seats`.
    - *Note: Kinde allows restricting signups, but we may need to use Kinde Management API to enable/disable invites based on seat count.*

**Tasks:**
- [ ] Create `api/kinde/webhook` to listen for `organization.created` and `user.created` events.
- [ ] Update `api/organizations/buy-seats.js` to accept `kindeOrgId`.
- [ ] Implement "Invite Member" UI that checks seat availability before calling Kinde API.

## Time Estimate
Based on the complexity of running a hybrid system:

| Phase | Description | Estimate |
|-------|-------------|----------|
| **1. Setup & Auth** | SDK integration, Dual Provider setup, Routing | 8-10 hours |
| **2. Backend Core** | Unified Middleware, Token Validation, User Normalization | 4-6 hours |
| **3. Database & Logic** | Schema updates, RLS, Seat counting logic | 4-6 hours |
| **4. Billing Integration** | Linking Kinde Orgs to Stripe, Webhooks | 6-8 hours |
| **Total** | | **22-30 hours** |