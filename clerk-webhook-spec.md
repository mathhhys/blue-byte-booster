# Clerk Webhook Handler Specification

This document outlines the data mapping and testing strategy for the enhanced Clerk webhook handler.

## Data Mapping

The following table details the mapping between Clerk's user object and the Supabase `users` table:

| Clerk Field          | Supabase `users` Column | Notes                               |
| -------------------- | ----------------------- | ----------------------------------- |
| `id`                 | `clerk_id`              | Primary identifier for mapping.     |
| `email_addresses[0]` | `email`                 | The primary email address.          |
| `first_name`         | `first_name`            | User's first name.                  |
| `last_name`          | `last_name`             | User's last name.                   |
| `image_url`          | `avatar_url`            | URL for the user's avatar.          |
| -                    | `plan_type`             | Defaults to 'starter' on creation.  |
| -                    | `credits`               | Defaults to 25 on creation.         |

## Testing Strategy

The webhook handler will be tested using sample payloads for an `organization membership` event.
