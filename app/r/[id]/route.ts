import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaignSends, campaignEvents } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { verifyTrackingPayload } from '@/lib/tracking'
import { logger } from '@/lib/logger'

const MAX_PAYLOAD_BYTES = 4096

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const home = new URL('/', req.url)

  if (!params.id || params.id.length > MAX_PAYLOAD_BYTES) {
    logger.warn({ tokenLength: params.id?.length }, 'Click redirect rejected: token too long or empty')
    return NextResponse.redirect(home)
  }

  const payload = verifyTrackingPayload(params.id)
  if (!payload) {
    logger.warn({ ip: req.headers.get('x-forwarded-for') }, 'Click redirect rejected: invalid signature')
    return NextResponse.redirect(home)
  }

  let sendId: string
  let url: string
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as { sendId: string; url: string }
    sendId = decoded.sendId
    url = decoded.url
  } catch {
    logger.warn('Click redirect rejected: payload not parseable')
    return NextResponse.redirect(home)
  }

  if (typeof url !== 'string') {
    return NextResponse.redirect(home)
  }

  // Only allow http(s) destinations. Blocks javascript:, data:, file:, etc.
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.redirect(home)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    logger.warn({ protocol: parsed.protocol }, 'Click redirect rejected: non-http protocol')
    return NextResponse.redirect(home)
  }

  if (sendId) {
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
  }

  return NextResponse.redirect(parsed.toString())
}
