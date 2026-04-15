import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaignSends, campaignEvents, contacts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Webhook } from 'svix'

async function handleBounceOrComplaint(
  providerMessageId: string,
  contactStatus: string,
  eventType: string
) {
  const [send] = await db
    .select()
    .from(campaignSends)
    .where(eq(campaignSends.providerMessageId, providerMessageId))

  if (!send) return

  await db
    .update(campaignSends)
    .set({ status: eventType === 'bounce' ? 'bounced' : 'failed' })
    .where(eq(campaignSends.id, send.id))

  await db
    .update(contacts)
    .set({ status: contactStatus })
    .where(eq(contacts.id, send.contactId))

  await db.insert(campaignEvents).values({
    campaignSendId: send.id,
    campaignId: send.campaignId,
    type: eventType,
  })
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    // If no secret configured, skip verification (for development)
    if (webhookSecret) {
      const wh = new Webhook(webhookSecret)
      const svixHeaders = {
        'svix-id': req.headers.get('svix-id') ?? '',
        'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
        'svix-signature': req.headers.get('svix-signature') ?? '',
      }
      wh.verify(rawBody, svixHeaders)
    }

    const event = JSON.parse(rawBody)
    const { type, data } = event

    if (type === 'email.bounced') {
      await handleBounceOrComplaint(data.email_id, 'bounced', 'bounce')
    } else if (type === 'email.complained') {
      await handleBounceOrComplaint(data.email_id, 'unsubscribed', 'complaint')
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Resend webhook error:', err)
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 })
  }
}
