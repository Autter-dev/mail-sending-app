import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaigns, campaignSends, contacts, suppressions } from '@/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { getQueue, JOBS } from '@/lib/queue'
import { logger, trackEvent } from '@/lib/logger'
import { auditFromSession, logAudit } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  logger.info({ campaignId: params.id }, 'Campaign send requested')

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
    logger.warn({ campaignId: params.id }, 'Campaign not found for send')
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  // Validate required fields
  if (!campaign.subject || campaign.subject.trim() === '') {
    logger.warn({ campaignId: params.id }, 'Campaign missing subject')
    return NextResponse.json({ error: 'Campaign is missing a subject line' }, { status: 400 })
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!campaign.fromEmail || !emailRegex.test(campaign.fromEmail)) {
    logger.warn({ campaignId: params.id, fromEmail: campaign.fromEmail }, 'Campaign from email is missing or invalid')
    return NextResponse.json({ error: 'Campaign "From email" is missing or invalid. Set a complete sender address (e.g. you@yourdomain.com) and save before sending.' }, { status: 400 })
  }
  if (!campaign.fromName || campaign.fromName.trim() === '') {
    logger.warn({ campaignId: params.id }, 'Campaign missing fromName')
    return NextResponse.json({ error: 'Campaign is missing a from name' }, { status: 400 })
  }
  if (!campaign.providerId) {
    logger.warn({ campaignId: params.id }, 'Campaign missing providerId')
    return NextResponse.json({ error: 'Campaign does not have an email provider selected' }, { status: 400 })
  }
  if (!campaign.listId) {
    logger.warn({ campaignId: params.id }, 'Campaign missing listId')
    return NextResponse.json({ error: 'Campaign does not have a contact list selected' }, { status: 400 })
  }

  // Check that the campaign has email body content (blocks or raw HTML)
  const hasContent = (campaign.templateJson && campaign.templateJson.length > 0) ||
    (campaign.templateHtml && campaign.templateHtml.trim().length > 0)
  if (!hasContent) {
    logger.warn({ campaignId: params.id }, 'Campaign has no email body content')
    return NextResponse.json({ error: 'Campaign has no email content. Add content in the editor and save before sending.' }, { status: 400 })
  }

  logger.info(
    { campaignId: params.id, listId: campaign.listId, providerId: campaign.providerId, scheduledAt },
    'Campaign validation passed, fetching contacts'
  )

  // Fetch active contacts for the list, excluding any whose email is on the global suppression list
  const contactList = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.listId, campaign.listId),
        eq(contacts.status, 'active'),
        sql`NOT EXISTS (SELECT 1 FROM ${suppressions} WHERE ${suppressions.email} = ${contacts.email})`
      )
    )

  if (contactList.length === 0) {
    logger.warn({ campaignId: params.id, listId: campaign.listId }, 'No active contacts in list')
    return NextResponse.json({ error: 'No active contacts in this list' }, { status: 400 })
  }

  logger.info({ campaignId: params.id, contactCount: contactList.length }, 'Contacts fetched, updating campaign status')

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
  logger.info({ campaignId: params.id, contactCount: contactList.length }, 'Inserting campaign_sends rows')
  for (let i = 0; i < contactList.length; i += 500) {
    const batch = contactList.slice(i, i + 500)
    await db.insert(campaignSends).values(
      batch.map((c) => ({
        campaignId: campaign.id,
        contactId: c.id,
        status: 'pending',
      }))
    )
    logger.debug({ campaignId: params.id, batchStart: i, batchSize: batch.length }, 'Inserted campaign_sends batch')
  }

  // Fetch all created campaign_sends for this campaign
  const sends = await db
    .select()
    .from(campaignSends)
    .where(eq(campaignSends.campaignId, campaign.id))

  // Enqueue individual send jobs
  logger.info({ campaignId: params.id, sendCount: sends.length }, 'Enqueuing send jobs')
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

  const durationMs = Date.now() - startTime
  logger.info(
    { campaignId: params.id, queued: sends.length, status: newStatus, durationMs },
    'Campaign send jobs enqueued successfully'
  )
  trackEvent('campaign_send_initiated', {
    campaignId: params.id,
    contactCount: contactList.length,
    status: newStatus,
    scheduledAt: scheduledAt || null,
    durationMs,
  })

  await logAudit(
    await auditFromSession(req),
    'campaign.send',
    { type: 'campaign', id: campaign.id },
    {
      totalRecipients: contactList.length,
      scheduledAt: scheduledAt ?? null,
      status: newStatus,
    },
  )

  return NextResponse.json({ queued: sends.length })
}
