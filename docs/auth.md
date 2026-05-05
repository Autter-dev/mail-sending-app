# Authentication

## Overview

NextAuth.js v4 with a credentials provider backed by the `users` table. Sessions are JWTs. Public routes are explicitly allowlisted in `middleware.ts`; everything else requires a session.

## User-facing flow

1. User visits any protected page and is redirected to `/login`.
2. User submits email and password.
3. On success, a JWT session is set and the user lands on `/dashboard`.
4. Sign out is in the sidebar footer and clears the session.

## Routes & pages

- `/login`: login form
- Protected: every dashboard page under `app/(dashboard)`
- Public: `/login`, `/unsubscribe/[token]`, `/confirm/[token]`, `/form/[id]`, `/accept-invite/[token]`, `/t/*`, `/r/*`, `/img/*`, `/f/*`, `/api/auth/*`, `/api/v1/*`, `/api/webhooks/*`, `/api/public/*`

## API endpoints

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET, POST | `/api/auth/[...nextauth]` | Public | NextAuth handler (sign in, sign out, session) |

## Key files

- `app/login/page.tsx`
- `app/api/auth/[...nextauth]/route.ts`
- `lib/auth.ts`: NextAuth options, credentials authorize callback
- `lib/auth-helpers.ts`: server-side session helpers
- `middleware.ts`: route allowlist

## Database

- `users`: id, email, password_hash (bcrypt), role, last_login_at

## Configuration

- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: bootstraps the first admin user when no users exist

## Notes

- Password reset is not implemented. Use team invites for new users.
- `middleware.ts` excludes the public surfaces above; adding new public routes requires updating the matcher.
