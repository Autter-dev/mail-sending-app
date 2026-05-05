# Mail Editor

## Overview

A drag-and-drop block editor for composing email templates, plus an alternate raw HTML mode for power users. Provides a live iframe preview with mobile and desktop sizing, merge tags, and test sends.

## User-facing flow

1. Open a campaign or template. The editor lives at `/editor/[campaignId]`.
2. Edit campaign metadata inline at the top: name, subject, from name, from email, provider.
3. Add blocks from the left panel. Click a block in the preview to edit its props on the right.
4. Drag to reorder blocks.
5. Toggle mobile/desktop preview width.
6. Use the merge-tag picker to copy `{{first_name}}`, `{{email}}`, etc.
7. Click "Send Test Email" to send to your own address before going live.
8. Click "Save Draft" or wait for the auto-save (every 30 seconds).
9. Toggle to "Code" mode to write raw HTML directly. The HTML editor preserves Handlebars merge tags.

## Block types

- `heading`: text, fontSize, color, alignment
- `text`: text, fontSize, color
- `button`: text, url, bgColor, textColor, align
- `image`: src (asset library or URL), alt, width
- `divider`: color
- `spacer`: height

## Routes & pages

- `/editor/[campaignId]`: editor

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/internal/campaigns/[id]` | Session | Load campaign |
| PATCH | `/api/internal/campaigns/[id]` | Session | Save edits |
| POST | `/api/internal/campaigns/[id]/test-send` | Session | Test send, body `{ toEmail }` |

## Key files

- Page: `app/(dashboard)/editor/[campaignId]/page.tsx`
- Block editor: `components/editor/BlockEditor.tsx`
- HTML editor: `components/editor/HtmlEditor.tsx`
- Block components: `components/editor/blocks/*`
- Asset picker: `components/editor/AssetPicker.tsx`
- Renderer: `lib/renderer/index.ts` (Handlebars + juice)

## Notes

- The preview is rendered server-style by `lib/renderer/index.ts` so what you see matches what gets sent.
- Auto-save fires every 30 seconds while there are unsaved changes.
- Switching from visual to code mode and back may reset block-level edits if the HTML can no longer be parsed back into blocks. The editor warns before discarding.
