# Team Management

## Overview

Multiple users with admin and member roles. New users join via email invitation with configurable expiry. Replaces the original single-admin env-var auth.

## User-facing flow

1. Admin visits `/settings/team`.
2. Click "Invite Member", enter an email, pick a role and an expiry (3, 7, or 30 days).
3. The invitee receives an email with a link to `/accept-invite/[token]`.
4. The invitee sets their password and gains access.
5. Admins can revoke pending invites or remove members from the team.

## Roles

- `admin`: full access, can manage users, providers, settings
- `member`: standard access, no team or provider management

## Routes & pages

- `/settings/team`: members and invites
- `/accept-invite/[token]`: public acceptance page

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/internal/team/members` | Session admin | List members |
| PATCH | `/api/internal/team/members/[id]` | Session admin | Update role |
| DELETE | `/api/internal/team/members/[id]` | Session admin | Remove member |
| GET | `/api/internal/team/invites` | Session admin | List pending invites |
| POST | `/api/internal/team/invites` | Session admin | Create invite |
| DELETE | `/api/internal/team/invites/[id]` | Session admin | Revoke invite |
| POST | `/api/public/accept-invite/[token]` | Public | Accept invite (sets password) |

## Database

- `users`: id, email, password_hash, role, last_login_at, created_at
- `invites`: id, email, role, token, expires_at, accepted_at, created_at

## Key files

- UI: `app/(dashboard)/settings/team/page.tsx`, `app/accept-invite/[token]/page.tsx`
- API: `app/api/internal/team/**`, `app/api/public/accept-invite/[token]/route.ts`
- Tokens: `lib/team/tokens.ts`

## Notes

- Removing the last admin is blocked. Promote another member first.
- Invite tokens are single-use and clear after acceptance.
- Expired invites are still revocable for cleanup.
