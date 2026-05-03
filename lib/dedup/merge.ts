import { db } from '@/lib/db'
import { contacts, campaignSends } from '@/lib/db/schema'
import { eq, inArray, and } from 'drizzle-orm'
import { mergeFields, type DedupCandidate } from './index'

export interface MergeGroupResult {
  winnerId: string
  loserIds: string[]
  reassignedSends: number
  droppedSends: number
}

/**
 * Merge a single duplicate group atomically.
 *
 * Reassigns campaign_sends from losers to winner before deleting losers, so
 * opens/clicks/bounces stay attributed. If a loser has a send for a campaign
 * already sent to the winner, the loser's row is dropped (cascade removes its
 * events) to satisfy the unique(campaignId, contactId) constraint.
 */
export async function mergeContactGroup(
  listId: string,
  winnerId: string,
  loserIds: string[],
): Promise<MergeGroupResult> {
  if (loserIds.length === 0) {
    throw new Error('mergeContactGroup requires at least one loser')
  }
  if (loserIds.includes(winnerId)) {
    throw new Error('winnerId cannot also be a loserId')
  }

  return db.transaction(async (tx) => {
    const ids = [winnerId, ...loserIds]
    const rows = await tx
      .select()
      .from(contacts)
      .where(and(inArray(contacts.id, ids), eq(contacts.listId, listId)))

    if (rows.length !== ids.length) {
      throw new Error('One or more contacts were not found in the given list')
    }
    const winner = rows.find((r) => r.id === winnerId)
    if (!winner) throw new Error('Winner contact not found')
    const losers = rows.filter((r) => r.id !== winnerId)

    const winnerCandidate: DedupCandidate = winner
    const loserCandidates: DedupCandidate[] = losers
    const merged = mergeFields(winnerCandidate, loserCandidates)

    // Find campaigns the winner already has sends for, to avoid unique violation.
    const winnerSends = await tx
      .select({ campaignId: campaignSends.campaignId })
      .from(campaignSends)
      .where(eq(campaignSends.contactId, winnerId))
    const winnerCampaignIds = new Set(winnerSends.map((s) => s.campaignId))

    let droppedSends = 0
    if (winnerCampaignIds.size > 0) {
      const collidingSends = await tx
        .select({ id: campaignSends.id })
        .from(campaignSends)
        .where(
          and(
            inArray(campaignSends.contactId, loserIds),
            inArray(campaignSends.campaignId, Array.from(winnerCampaignIds)),
          ),
        )
      if (collidingSends.length > 0) {
        const collidingIds = collidingSends.map((s) => s.id)
        await tx.delete(campaignSends).where(inArray(campaignSends.id, collidingIds))
        droppedSends = collidingIds.length
      }
    }

    const reassignResult = await tx
      .update(campaignSends)
      .set({ contactId: winnerId })
      .where(inArray(campaignSends.contactId, loserIds))
      .returning({ id: campaignSends.id })
    const reassignedSends = reassignResult.length

    await tx
      .update(contacts)
      .set({
        firstName: merged.firstName,
        lastName: merged.lastName,
        metadata: merged.metadata,
        status: merged.status,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, winnerId))

    await tx.delete(contacts).where(inArray(contacts.id, loserIds))

    return {
      winnerId,
      loserIds,
      reassignedSends,
      droppedSends,
    }
  })
}
