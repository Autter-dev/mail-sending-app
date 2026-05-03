import { db } from '@/lib/db'
import { contacts, campaigns, campaignSends, campaignEvents } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

export interface ContactExport {
  exportedAt: string
  contact: typeof contacts.$inferSelect
  sends: Array<typeof campaignSends.$inferSelect & { campaignName: string | null; campaignSubject: string | null }>
  events: Array<typeof campaignEvents.$inferSelect>
}

export async function buildContactExport(contactId: string): Promise<ContactExport | null> {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId))
  if (!contact) return null

  const sendsRows = await db
    .select({
      send: campaignSends,
      campaignName: campaigns.name,
      campaignSubject: campaigns.subject,
    })
    .from(campaignSends)
    .leftJoin(campaigns, eq(campaignSends.campaignId, campaigns.id))
    .where(eq(campaignSends.contactId, contactId))

  const sends = sendsRows.map((r) => ({
    ...r.send,
    campaignName: r.campaignName,
    campaignSubject: r.campaignSubject,
  }))

  const sendIds = sends.map((s) => s.id)
  const events = sendIds.length > 0
    ? await db.select().from(campaignEvents).where(inArray(campaignEvents.campaignSendId, sendIds))
    : []

  return {
    exportedAt: new Date().toISOString(),
    contact,
    sends,
    events,
  }
}

export interface ContactDeleteResult {
  email: string
  listId: string
  sendCount: number
  eventCount: number
}

export async function hardDeleteContact(contactId: string): Promise<ContactDeleteResult | null> {
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId))
  if (!contact) return null

  const sendsRows = await db
    .select({ id: campaignSends.id })
    .from(campaignSends)
    .where(eq(campaignSends.contactId, contactId))
  const sendIds = sendsRows.map((s) => s.id)
  const eventCount = sendIds.length > 0
    ? (await db
        .select({ id: campaignEvents.id })
        .from(campaignEvents)
        .where(inArray(campaignEvents.campaignSendId, sendIds))
      ).length
    : 0

  // Cascade FK deletes campaign_sends and campaign_events automatically.
  await db.delete(contacts).where(eq(contacts.id, contactId))

  return {
    email: contact.email,
    listId: contact.listId,
    sendCount: sendIds.length,
    eventCount,
  }
}
