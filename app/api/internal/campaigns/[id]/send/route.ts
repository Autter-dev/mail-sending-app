import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaigns, campaignSends, contacts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getQueue, JOBS } from '@/lib/queue'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { scheduledAt?: string } = {}
  try {
    body = await req.json()
  } catch {
    // Body is optional, default to empty object
  }

  const { scheduledAt } = body

  // Fetch campaign
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, params.id))

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  // Validate required fields
  if (!campaign.subject || campaign.subject.trim() === '') {
    return NextResponse.json({ error: 'Campaign is missing a subject line' }, { status: 400 })
  }
  if (!campaign.fromEmail || campaign.fromEmail.trim() === '') {
    return NextResponse.json({ error: 'Campaign is missing a from email address' }, { status: 400 })
  }
  if (!campaign.fromName || campaign.fromName.trim() === '') {
    return NextResponse.json({ error: 'Campaign is missing a from name' }, { status: 400 })
  }
  if (!campaign.providerId) {
    return NextResponse.json({ error: 'Campaign does not have an email provider selected' }, { status: 400 })
  }
  if (!campaign.listId) {
    return NextResponse.json({ error: 'Campaign does not have a contact list selected' }, { status: 400 })
  }

  // Fetch active contacts for the list
  const contactList = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.listId, campaign.listId), eq(contacts.status, 'active')))

  if (contactList.length === 0) {
    return NextResponse.json({ error: 'No active contacts in this list' }, { status: 400 })
  }

  // Update campaign status
  const newStatus = scheduledAt ? 'scheduled' : 'sending'
  await db
    .update(campaigns)
    .set({
      status: newStatus,
      totalRecipients: contactList.length,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaign.id))

  // Insert campaign_sends rows in batches of 500
  for (let i = 0; i < contactList.length; i += 500) {
    const batch = contactList.slice(i, i + 500)
    await db.insert(campaignSends).values(
      batch.map((c) => ({
        campaignId: campaign.id,
        contactId: c.id,
        status: 'pending',
      }))
    )
  }

  // Fetch all created campaign_sends for this campaign
  const sends = await db
    .select()
    .from(campaignSends)
    .where(eq(campaignSends.campaignId, campaign.id))

  // Enqueue individual send jobs
  const queue = await getQueue()
  const sendOptions = scheduledAt ? { startAfter: new Date(scheduledAt) } : undefined

  for (const send of sends) {
    await queue.send(JOBS.SEND_EMAIL, { sendId: send.id, campaignId: campaign.id }, sendOptions)
  }

  // Enqueue finalize job with estimated delay
  const estimatedSeconds = Math.max(60, Math.ceil(contactList.length / 5) * 2 + 60)
  const finalizeAfter = scheduledAt
    ? new Date(new Date(scheduledAt).getTime() + estimatedSeconds * 1000)
    : new Date(Date.now() + estimatedSeconds * 1000)

  await queue.send(
    JOBS.FINALIZE_CAMPAIGN,
    { campaignId: campaign.id },
    { startAfter: finalizeAfter }
  )

  return NextResponse.json({ queued: sends.length })
}
