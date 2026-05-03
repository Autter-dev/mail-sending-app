import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetSeconds: number
}

interface RateLimitRow {
  rate_limit_per_minute: number
  refilled: number
  remaining_tokens: number
  allowed: boolean
}

/**
 * Atomic token-bucket consume for an API key. The bucket refills at rate_limit_per_minute / 60
 * tokens per second up to a capacity of rate_limit_per_minute. Each call refills based on elapsed
 * time and conditionally decrements one token in a single UPDATE so concurrent requests from the
 * same key serialize through Postgres row-level locking.
 */
export async function consumeApiKeyToken(keyId: string): Promise<RateLimitResult> {
  const result = await db.execute(sql`
    WITH refill AS (
      SELECT
        id,
        rate_limit_per_minute,
        LEAST(
          rate_limit_per_minute::double precision,
          rate_limit_tokens + EXTRACT(EPOCH FROM (now() - rate_limit_updated_at)) * (rate_limit_per_minute / 60.0)
        ) AS refilled
      FROM api_keys
      WHERE id = ${keyId}
      FOR UPDATE
    ),
    upd AS (
      UPDATE api_keys
      SET
        rate_limit_tokens = CASE
          WHEN refill.refilled >= 1 THEN refill.refilled - 1
          ELSE refill.refilled
        END,
        rate_limit_updated_at = now()
      FROM refill
      WHERE api_keys.id = refill.id
      RETURNING
        refill.rate_limit_per_minute,
        refill.refilled,
        api_keys.rate_limit_tokens AS remaining_tokens,
        (refill.refilled >= 1) AS allowed
    )
    SELECT * FROM upd
  `)

  const rows = (result as unknown as { rows?: RateLimitRow[] }).rows
    ?? (Array.isArray(result) ? (result as RateLimitRow[]) : [])
  const row = rows[0]

  if (!row) {
    return { allowed: false, limit: 0, remaining: 0, resetSeconds: 60 }
  }

  const limit = Number(row.rate_limit_per_minute)
  const remaining = Math.max(0, Math.floor(Number(row.remaining_tokens)))
  const allowed = Boolean(row.allowed)
  const refillRatePerSec = limit / 60
  const tokensRemaining = Number(row.remaining_tokens)
  const resetSeconds = allowed
    ? 0
    : Math.max(1, Math.ceil((1 - tokensRemaining) / refillRatePerSec))

  return { allowed, limit, remaining, resetSeconds }
}
