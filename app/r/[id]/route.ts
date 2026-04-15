import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaignSends, campaignEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const decoded = JSON.parse(Buffer.from(params.id, 'base64url').toString('utf-8'))
    const { sendId, url } = decoded as { sendId: string; url: string }

    const send = await db.query.campaignSends.findFirst({
      where: eq(campaignSends.id, sendId),
    })

    if (send) {
      await db.insert(campaignEvents).values({
        campaignSendId: send.id,
        campaignId: send.campaignId,
        type: 'click',
        linkUrl: url,
        ipAddress: req.headers.get('x-forwarded-for') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
      })
    }

    return NextResponse.redirect(url)
  } catch {
    return NextResponse.redirect(new URL('/', req.url))
  }
}
