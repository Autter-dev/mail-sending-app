import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaigns } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const [updated] = await db
    .update(campaigns)
    .set({
      cancelRequested: true,
      status: 'draft',
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, params.id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
