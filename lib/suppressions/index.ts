import { db } from '@/lib/db'
import { suppressions } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

export type SuppressionReason = 'bounce' | 'complaint' | 'unsubscribe' | 'manual' | 'imported'

export interface SuppressInput {
  email: string
  reason: SuppressionReason
  source?: string | null
  metadata?: Record<string, unknown>
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function isSuppressed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  const [row] = await db
    .select({ id: suppressions.id })
    .from(suppressions)
    .where(eq(suppressions.email, normalized))
    .limit(1)
  return !!row
}

export async function suppressEmail(input: SuppressInput): Promise<void> {
  const email = normalizeEmail(input.email)
  if (!email) return
  await db
    .insert(suppressions)
    .values({
      email,
      reason: input.reason,
      source: input.source ?? null,
      metadata: input.metadata ?? {},
    })
    .onConflictDoNothing({ target: suppressions.email })
}

export async function suppressEmailsBulk(
  rows: SuppressInput[]
): Promise<{ inserted: number; skipped: number }> {
  if (rows.length === 0) return { inserted: 0, skipped: 0 }

  const seen = new Set<string>()
  const dedup: { email: string; reason: SuppressionReason; source: string | null; metadata: Record<string, unknown> }[] = []
  for (const r of rows) {
    const email = normalizeEmail(r.email)
    if (!email) continue
    if (seen.has(email)) continue
    seen.add(email)
    dedup.push({ email, reason: r.reason, source: r.source ?? null, metadata: r.metadata ?? {} })
  }

  let inserted = 0
  const BATCH = 500
  for (let i = 0; i < dedup.length; i += BATCH) {
    const chunk = dedup.slice(i, i + BATCH)
    const result = await db
      .insert(suppressions)
      .values(chunk)
      .onConflictDoNothing({ target: suppressions.email })
      .returning({ id: suppressions.id })
    inserted += result.length
  }

  return { inserted, skipped: rows.length - inserted }
}

export async function unsuppressEmailById(id: string): Promise<{ id: string; email: string } | null> {
  const result = await db
    .delete(suppressions)
    .where(eq(suppressions.id, id))
    .returning({ id: suppressions.id, email: suppressions.email })
  return result[0] ?? null
}

export async function unsuppressEmail(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return false
  const result = await db
    .delete(suppressions)
    .where(eq(suppressions.email, normalized))
    .returning({ id: suppressions.id })
  return result.length > 0
}

export async function countSuppressions(): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(suppressions)
  return row?.count ?? 0
}
