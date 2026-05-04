interface Bucket {
  tokens: number
  updatedAt: number
}

const buckets = new Map<string, Bucket>()

const DEFAULT_CAPACITY = 10
const DEFAULT_REFILL_PER_SECOND = 10 / 60
const SWEEP_INTERVAL_MS = 60_000
const MAX_BUCKETS = 10_000

let lastSweep = 0

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS && buckets.size < MAX_BUCKETS) return
  lastSweep = now
  buckets.forEach((bucket, key) => {
    if (now - bucket.updatedAt > SWEEP_INTERVAL_MS * 10) buckets.delete(key)
  })
}

export interface IpRateLimitOptions {
  capacity?: number
  refillPerSecond?: number
}

export interface IpRateLimitResult {
  allowed: boolean
  remaining: number
  resetSeconds: number
}

export function consumeIpToken(ip: string, scope: string, opts: IpRateLimitOptions = {}): IpRateLimitResult {
  const capacity = opts.capacity ?? DEFAULT_CAPACITY
  const refillPerSecond = opts.refillPerSecond ?? DEFAULT_REFILL_PER_SECOND
  const key = `${scope}:${ip}`
  const now = Date.now()
  sweep(now)

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { tokens: capacity, updatedAt: now }
    buckets.set(key, bucket)
  }

  const elapsedSec = (now - bucket.updatedAt) / 1000
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSecond)
  bucket.updatedAt = now

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      resetSeconds: 0,
    }
  }

  const needed = 1 - bucket.tokens
  return {
    allowed: false,
    remaining: 0,
    resetSeconds: Math.max(1, Math.ceil(needed / refillPerSecond)),
  }
}

export function extractIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip') ?? 'unknown'
}
