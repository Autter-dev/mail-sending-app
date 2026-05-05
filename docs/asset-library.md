# Asset Library

## Overview

Stores uploaded images in S3 (or MinIO) and serves them through a stable proxy URL. The mail editor's image block uses an asset picker to pull from the library.

## User-facing flow

1. Visit `/assets`.
2. Drop image files (PNG, JPEG, GIF, WebP, SVG) up to 5 MB each.
3. Click an asset to copy its `/img/[id]` URL or delete it.
4. From the editor, the image block opens an asset picker that inserts the URL automatically.

## Routes & pages

- `/assets`: index
- `/img/[fileId]`: public proxy URL embedded in emails (no expiry)

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/internal/assets` | Session | List assets |
| POST | `/api/internal/assets` | Session | Upload asset (multipart) |
| DELETE | `/api/internal/assets/[id]` | Session | Delete asset |
| POST | `/api/internal/images` | Session | Legacy direct image upload (used by older block) |
| GET | `/img/[id]` | Public | Stream the asset bytes from S3 |

## Key files

- UI: `app/(dashboard)/assets/page.tsx`, `components/editor/AssetPicker.tsx`
- API: `app/api/internal/assets/**`, `app/api/internal/images/route.ts`, `app/img/[id]/route.ts`
- Storage: `lib/storage/index.ts`

## Database

- `assets`: id, file_name, content_type, size_bytes, s3_key, created_at

## Notes

- Asset URLs use a stable proxy (`/img/[id]`) so the same URL works long-term, even when the underlying S3 object key changes.
- The proxy streams from S3 server-side. Use a CDN in front of the app for production.
- Deleting an asset does not break already-sent emails: provider-cached copies survive, but inboxes that re-fetch will see a 404.
