import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Built-in tags always available
  const builtIn = [
    { tag: '{{email}}', description: 'Contact email address' },
    { tag: '{{first_name}}', description: 'Contact first name' },
    { tag: '{{last_name}}', description: 'Contact last name' },
    { tag: '{{unsubscribe_url}}', description: 'One-click unsubscribe link' },
  ]

  // Find custom metadata keys from contacts in this list
  const rows = await db
    .select({ metadata: contacts.metadata })
    .from(contacts)
    .where(eq(contacts.listId, params.id))
    .limit(100)

  const metadataKeys = new Set<string>()
  for (const row of rows) {
    if (row.metadata && typeof row.metadata === 'object') {
      for (const key of Object.keys(row.metadata as Record<string, unknown>)) {
        metadataKeys.add(key)
      }
    }
  }

  const custom = Array.from(metadataKeys)
    .sort()
    .map((key) => ({
      tag: `{{${key}}}`,
      description: `Custom field: ${key}`,
    }))

  return NextResponse.json([...builtIn, ...custom])
}
