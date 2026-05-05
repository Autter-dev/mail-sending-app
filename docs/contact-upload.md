# Contact Upload

## Overview

Three-step import for CSV and XLSX files: upload, map columns, confirm. Files are staged in S3 between steps so the user can adjust the mapping without re-uploading.

## User-facing flow

1. From a list detail page, click "Upload Contacts".
2. Drop a `.csv` or `.xlsx` file. The server returns the header row and a 5-row preview.
3. Map each column to one of: email (required), first name, last name, or a custom metadata key.
4. Confirm. The server upserts contacts in batches of 500 and returns counts.

## Routes & pages

- `/lists/[id]/upload`: the three-step UI

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/internal/lists/[id]/upload` | Session | `multipart/form-data` file upload. Returns `{ s3Key, headers, preview }`. |
| POST | `/api/internal/lists/[id]/upload/confirm` | Session | Body `{ s3Key, mapping }`. Returns `{ inserted, updated, skipped }`. |

## Key files

- UI: `app/(dashboard)/lists/[id]/upload/page.tsx`
- API: `app/api/internal/lists/[id]/upload/route.ts`, `.../upload/confirm/route.ts`
- Storage: `lib/storage/index.ts` (S3 client)

## Mapping shape

```ts
{
  email: number,            // required, column index of the email field
  firstName?: number,
  lastName?: number,
  metadata: { [key: string]: number }  // arbitrary metadata column mapping
}
```

## Notes

- SheetJS (`xlsx`) parses both formats. The first sheet of an XLSX is used.
- Uploads are stored at `uploads/[listId]/[timestamp].xlsx`.
- Existing contacts (matched by `(list_id, email)`) are updated, not replaced. The status is preserved.
- Suppressed emails still get inserted into the list but are skipped at send time.
