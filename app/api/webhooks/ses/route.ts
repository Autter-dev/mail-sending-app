import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaignSends, campaignEvents, contacts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { suppressEmail } from '@/lib/suppressions'

async function handleBounceOrComplaint(
  providerMessageId: string,
  contactStatus: string,
  eventType: string,
  shouldSuppress: boolean
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

  const [contact] = await db
    .update(contacts)
    .set({ status: contactStatus })
    .where(eq(contacts.id, send.contactId))
    .returning({ email: contacts.email })

  await db.insert(campaignEvents).values({
    campaignSendId: send.id,
    campaignId: send.campaignId,
    type: eventType,
  })

  if (shouldSuppress && contact?.email) {
    await suppressEmail({
      email: contact.email,
      reason: eventType === 'complaint' ? 'complaint' : 'bounce',
      source: 'ses',
      metadata: { providerMessageId, campaignId: send.campaignId, campaignSendId: send.id },
    })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.Type === 'SubscriptionConfirmation') {
      await fetch(body.SubscribeURL)
      return NextResponse.json({ received: true })
    }

    if (body.Type === 'Notification') {
      const message = JSON.parse(body.Message)

      if (message.notificationType === 'Bounce') {
        const messageId: string = message.mail.messageId
        const recipientCount: number = (message.bounce.bouncedRecipients as unknown[]).length
        // Only Permanent bounces add to global suppressions. Transient bounces still flip per-list status.
        const isPermanent: boolean = message.bounce.bounceType === 'Permanent'
        for (let i = 0; i < recipientCount; i++) {
          await handleBounceOrComplaint(messageId, 'bounced', 'bounce', isPermanent)
        }
      } else if (message.notificationType === 'Complaint') {
        const messageId: string = message.mail.messageId
        const recipientCount: number = (message.complaint.complainedRecipients as unknown[]).length
        for (let i = 0; i < recipientCount; i++) {
          await handleBounceOrComplaint(messageId, 'unsubscribed', 'complaint', true)
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('SES webhook error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
