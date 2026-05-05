import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaignSends, campaignEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest, { params }: { params: { sendId: string } }) {
  // Always return the pixel even on misses, but only hit the DB on well-formed IDs.
  const send = UUID_RE.test(params.sendId)
    ? await db.query.campaignSends.findFirst({ where: eq(campaignSends.id, params.sendId) })
    : null

  if (send) {
    await db.insert(campaignEvents).values({
      campaignSendId: send.id,
      campaignId: send.campaignId,
      type: 'open',
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    })
  }

  // Return 1x1 transparent GIF
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
  return new NextResponse(gif, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
