# Deduplication

## Overview

Detects and merges duplicate contacts inside a single list. A separate read-only view shows the same email present across multiple lists.

## User-facing flow

1. On a list detail page, open the Duplicates tab.
2. Each duplicate group is shown with the proposed winner highlighted.
3. Confirm to merge: the loser rows are deleted, metadata is combined, and the worst status across the group is preserved.
4. The cross-list view at `/lists/duplicates` is informational only. No automatic merging across lists.

## Routes & pages

- `/lists/[id]`: Duplicates tab (rendered by `components/lists/DuplicatesTab.tsx`)
- `/lists/duplicates`: cross-list view

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/internal/lists/[id]/duplicates` | Session | List duplicate groups in a single list |
| POST | `/api/internal/lists/[id]/duplicates/merge` | Session | Merge a group, body `{ winnerId, loserIds }` |
| GET | `/api/internal/duplicates/cross-list` | Session | Read-only view of emails appearing in multiple lists |

## Key files

- UI: `components/lists/DuplicatesTab.tsx`, `app/(dashboard)/lists/duplicates/page.tsx`
- API: `app/api/internal/lists/[id]/duplicates/**`, `app/api/internal/duplicates/cross-list/route.ts`
- Logic: `lib/dedup/index.ts`, `lib/dedup/merge.ts`

## Winner selection

1. Most recently updated wins.
2. Tie broken by completeness (more non-null fields).
3. Final tie broken by stable ID order.

## Merge behavior

- Metadata: loser keys are merged in first, then winner overwrites on conflict.
- Status: worst status across the group wins. Order: `unsubscribed` > `bounced` > `pending` > `active`.
- All `campaign_sends` and `campaign_events` rows pointing at losers cascade-delete with the loser contact.

## Notes

- Email comparison normalizes case and trims whitespace.
- Cross-list duplicates are intentionally not auto-merged because lists are independent units of consent.
