import { PgBoss } from 'pg-boss'
import { db } from './lib/db'
import { campaigns, campaignSends, contacts, emailProviders } from './lib/db/schema'
import { eq } from 'drizzle-orm'
import { createProviderAdapter } from './lib/providers/factory'
import { renderTemplate, renderPlainText } from './lib/renderer'
import { JOBS } from './lib/queue'
import { logger, trackEvent, trackError, shutdownTracking } from './lib/logger'
import { isSuppressed } from './lib/suppressions'
import { sendConfirmation } from './lib/email/sendConfirmation'

const APP_URL = process.env.APP_URL!
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5')

if (/localhost|127\.0\.0\.1/i.test(APP_URL)) {
  logger.warn(
    { appUrl: APP_URL },
    'APP_URL points to localhost. External email clients (Gmail, Outlook) cannot reach this host, so embedded images and tracking pixels will not load. Use a public URL or a tunnel (ngrok, cloudflared) for real sends.'
  )
}

async function processSendJob(sendId: string, campaignId: string) {
  const startTime = Date.now()
  logger.info({ sendId, campaignId }, 'Processing send job')

  // Fetch campaign from DB
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId))

  if (campaign) {
    logger.info({
      sendId,
      campaignId,
      campaignSubject: campaign.subject,
      campaignStatus: campaign.status,
      templateJsonType: typeof campaign.templateJson,
      templateJsonIsArray: Array.isArray(campaign.templateJson),
      templateJsonLength: Array.isArray(campaign.templateJson) ? campaign.templateJson.length : 'N/A',
      templateJsonPreview: JSON.stringify(campaign.templateJson)?.substring(0, 500),
      templateHtmlLength: campaign.templateHtml ? campaign.templateHtml.length : 0,
      templateHtmlPreview: campaign.templateHtml ? campaign.templateHtml.substring(0, 200) : null,
    }, 'Fetched campaign template data from DB')
  }

  // Check for cancel
  if (!campaign || campaign.cancelRequested) {
    logger.warn({ sendId, campaignId, cancelRequested: campaign?.cancelRequested }, 'Campaign cancelled or not found, skipping send')
    await db.update(campaignSends).set({ status: 'failed', errorMessage: 'Cancelled' }).where(eq(campaignSends.id, sendId))
    trackEvent('email_send_skipped', { sendId, campaignId, reason: 'cancelled' })
    return
  }

  const [send] = await db.select().from(campaignSends).where(eq(campaignSends.id, sendId))
  if (!send) {
    logger.warn({ sendId }, 'Send record not found, skipping')
    return
  }

  const [contact] = await db.select().from(contacts).where(eq(contacts.id, send.contactId))
  if (!contact || contact.status !== 'active') {
    logger.warn({ sendId, contactId: send.contactId, contactStatus: contact?.status }, 'Contact not active, skipping send')
    await db.update(campaignSends).set({ status: 'failed', errorMessage: 'Contact not active' }).where(eq(campaignSends.id, sendId))
    trackEvent('email_send_skipped', { sendId, campaignId, reason: 'contact_not_active' })
    return
  }

  if (await isSuppressed(contact.email)) {
    logger.warn({ sendId, contactId: send.contactId, contactEmail: contact.email }, 'Email is globally suppressed, skipping send')
    await db.update(campaignSends).set({ status: 'failed', errorMessage: 'Globally suppressed' }).where(eq(campaignSends.id, sendId))
    trackEvent('email_send_skipped', { sendId, campaignId, reason: 'suppressed' })
    return
  }

  const [provider] = await db.select().from(emailProviders).where(eq(emailProviders.id, campaign.providerId!))
  if (!provider) {
    logger.error({ sendId, campaignId, providerId: campaign.providerId }, 'Provider not found')
    trackError(new Error('Provider not found'), { sendId, campaignId, providerId: campaign.providerId })
    throw new Error('Provider not found')
  }

  logger.info(
    { sendId, campaignId, contactEmail: contact.email, providerType: provider.type },
    'Preparing email for send'
  )

  const adapter = createProviderAdapter(provider.type, provider.configEncrypted)

  const contactData: Record<string, string> = {
    email: contact.email,
    first_name: contact.firstName || '',
    last_name: contact.lastName || '',
    unsubscribe_url: `${APP_URL}/unsubscribe/${contact.unsubscribeToken}`,
    ...(contact.metadata as Record<string, string>),
  }

  logger.info({
    sendId,
    contactEmail: contact.email,
    contactDataKeys: Object.keys(contactData),
    contactFirstName: contactData.first_name,
    contactLastName: contactData.last_name,
  }, 'Contact data prepared for merge tags')

  logger.info({ sendId, contactEmail: contact.email }, 'Rendering email template')
  const html = renderTemplate({
    blocks: campaign.templateJson,
    contact: contactData,
    sendId: send.id,
    appUrl: APP_URL,
    unsubscribeUrl: `${APP_URL}/unsubscribe/${contact.unsubscribeToken}`,
    rawHtml: campaign.templateHtml,
  })

  logger.info({
    sendId,
    renderedHtmlLength: html.length,
    renderedHtmlPreview: html.substring(0, 500),
    htmlContainsBody: html.includes('<body'),
    htmlContainsUnsubscribe: html.includes('Unsubscribe'),
  }, 'Rendered email HTML for inspection')

  const text = renderPlainText(html)

  logger.info({ sendId, contactEmail: contact.email, subject: campaign.subject, htmlLength: html.length, textLength: text.length }, 'Sending email via provider')
  const { messageId } = await adapter.send({
    to: contact.email,
    from: campaign.fromEmail,
    fromName: campaign.fromName,
    subject: campaign.subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${APP_URL}/unsubscribe/${contact.unsubscribeToken}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })

  await db.update(campaignSends).set({
    status: 'sent',
    providerMessageId: messageId,
    sentAt: new Date(),
  }).where(eq(campaignSends.id, send.id))

  const durationMs = Date.now() - startTime
  logger.info(
    { sendId, campaignId, contactEmail: contact.email, messageId, durationMs },
    'Email sent and recorded successfully'
  )
  trackEvent('email_send_complete', { sendId, campaignId, providerType: provider.type, durationMs })
}

async function main() {
  logger.info({ concurrency: CONCURRENCY, appUrl: APP_URL }, 'Worker starting')

  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    max: 10,
  })

  await boss.start()
  logger.info('pg-boss started')

  // Create queues if they don't exist (required in pg-boss v12+)
  for (const queue of [JOBS.SEND_EMAIL, JOBS.FINALIZE_CAMPAIGN, JOBS.SEND_CONFIRMATION]) {
    try {
      await boss.createQueue(queue)
      logger.info({ queue }, 'Queue created')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (!msg.includes('already exists')) throw e
      logger.debug({ queue }, 'Queue already exists')
    }
  }
  logger.info('All queues ready')

  // Process individual email send jobs
  await boss.work<{ sendId: string; campaignId: string }>(
    JOBS.SEND_EMAIL,
    { localConcurrency: CONCURRENCY },
    async (jobs) => {
      for (const job of jobs) {
        try {
          await processSendJob(job.data.sendId, job.data.campaignId)
        } catch (err) {
          logger.error(
            { err, sendId: job.data.sendId, campaignId: job.data.campaignId, jobId: job.id },
            'Send job failed'
          )
          trackError(err, { action: 'send_job', sendId: job.data.sendId, campaignId: job.data.campaignId })

          // Mark the send as failed in the database
          try {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error'
            await db.update(campaignSends)
              .set({ status: 'failed', errorMessage })
              .where(eq(campaignSends.id, job.data.sendId))
          } catch (dbErr) {
            logger.error({ err: dbErr, sendId: job.data.sendId }, 'Failed to update send status after error')
          }
        }
      }
    }
  )

  // Finalize campaign after all sends complete
  await boss.work<{ campaignId: string }>(JOBS.FINALIZE_CAMPAIGN, async (jobs) => {
    for (const job of jobs) {
      const { campaignId } = job.data
      logger.info({ campaignId }, 'Finalizing campaign')
      try {
        await db.update(campaigns).set({ status: 'sent', sentAt: new Date() }).where(eq(campaigns.id, campaignId))
        logger.info({ campaignId }, 'Campaign finalized successfully')
        trackEvent('campaign_finalized', { campaignId })
      } catch (err) {
        logger.error({ err, campaignId }, 'Failed to finalize campaign')
        trackError(err, { action: 'finalize_campaign', campaignId })
      }
    }
  })

  // Send double opt-in confirmation emails
  await boss.work<{ contactId: string }>(JOBS.SEND_CONFIRMATION, async (jobs) => {
    for (const job of jobs) {
      const { contactId } = job.data
      logger.info({ contactId, jobId: job.id }, 'Processing confirmation send job')
      try {
        await sendConfirmation(contactId)
        trackEvent('confirmation_email_sent', { contactId })
      } catch (err) {
        logger.error({ err, contactId, jobId: job.id }, 'Confirmation send job failed')
        trackError(err, { action: 'send_confirmation', contactId })
        throw err
      }
    }
  })

  logger.info('Worker ready, processing jobs')
  trackEvent('worker_started', { concurrency: CONCURRENCY })

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down worker')
    await boss.stop()
    await shutdownTracking()
    process.exit(0)
  })
}

main().catch(async (err) => {
  logger.fatal({ err }, 'Worker failed to start')
  trackError(err, { action: 'worker_startup' })
  await shutdownTracking()
  process.exit(1)
})
