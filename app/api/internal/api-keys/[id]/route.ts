import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const [deleted] = await db
    .delete(apiKeys)
    .where(eq(apiKeys.id, params.id))
    .returning({ id: apiKeys.id })

  if (!deleted) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
