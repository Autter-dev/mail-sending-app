import { PgBoss } from 'pg-boss'
import { db } from './lib/db'
import { campaigns, campaignSends, contacts, emailProviders } from './lib/db/schema'
import { eq } from 'drizzle-orm'
import { createProviderAdapter } from './lib/providers/factory'
import { renderTemplate } from './lib/renderer'
import { JOBS } from './lib/queue'

const APP_URL = process.env.APP_URL!
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5')

async function processSendJob(sendId: string, campaignId: string) {
  // Check for cancel
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId))
  if (!campaign || campaign.cancelRequested) {
    await db.update(campaignSends).set({ status: 'failed', errorMessage: 'Cancelled' }).where(eq(campaignSends.id, sendId))
    return
  }

  const [send] = await db.select().from(campaignSends).where(eq(campaignSends.id, sendId))
  if (!send) return

  const [contact] = await db.select().from(contacts).where(eq(contacts.id, send.contactId))
  if (!contact || contact.status !== 'active') {
    await db.update(campaignSends).set({ status: 'failed', errorMessage: 'Contact not active' }).where(eq(campaignSends.id, sendId))
    return
  }

  const [provider] = await db.select().from(emailProviders).where(eq(emailProviders.id, campaign.providerId!))
  if (!provider) throw new Error('Provider not found')

  const adapter = createProviderAdapter(provider.type, provider.configEncrypted)

  const contactData: Record<string, string> = {
    email: contact.email,
    first_name: contact.firstName || '',
    last_name: contact.lastName || '',
    unsubscribe_url: `${APP_URL}/unsubscribe/${contact.unsubscribeToken}`,
    ...(contact.metadata as Record<string, string>),
  }

  const html = renderTemplate({
    blocks: campaign.templateJson,
    contact: contactData,
    sendId: send.id,
    appUrl: APP_URL,
    unsubscribeUrl: `${APP_URL}/unsubscribe/${contact.unsubscribeToken}`,
    rawHtml: campaign.templateHtml,
  })

  const { messageId } = await adapter.send({
    to: contact.email,
    from: campaign.fromEmail,
    fromName: campaign.fromName,
    subject: campaign.subject,
    html,
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
}

async function main() {
  console.log('Worker starting...')

  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    max: 10,
  })

  await boss.start()
  console.log('pg-boss started.')

  // Create queues if they don't exist (required in pg-boss v12+)
  for (const queue of [JOBS.SEND_EMAIL, JOBS.FINALIZE_CAMPAIGN]) {
    try {
      await boss.createQueue(queue)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (!msg.includes('already exists')) throw e
    }
  }
  console.log('Queues ready.')

  // Process individual email send jobs
  await boss.work<{ sendId: string; campaignId: string }>(
    JOBS.SEND_EMAIL,
    { localConcurrency: CONCURRENCY },
    async (jobs) => {
      for (const job of jobs) {
        await processSendJob(job.data.sendId, job.data.campaignId)
      }
    }
  )

  // Finalize campaign after all sends complete
  await boss.work<{ campaignId: string }>(JOBS.FINALIZE_CAMPAIGN, async (jobs) => {
    for (const job of jobs) {
      const { campaignId } = job.data
      await db.update(campaigns).set({ status: 'sent', sentAt: new Date() }).where(eq(campaigns.id, campaignId))
    }
  })

  console.log('Worker ready. Processing jobs...')
  process.on('SIGTERM', async () => { await boss.stop(); process.exit(0) })
}

main().catch((err) => { console.error(err); process.exit(1) })
