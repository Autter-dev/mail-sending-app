import { createHmac, timingSafeEqual } from 'crypto'

const SIG_LENGTH = 32 // hex chars (= 16 bytes of HMAC-SHA256, plenty for non-cryptographic auth)

function getSecret(): string {
  const explicit = process.env.TRACKING_SECRET
  if (explicit && explicit.length >= 16) return explicit
  const fallback = process.env.ENCRYPTION_KEY
  if (fallback && fallback.length >= 16) return fallback
  throw new Error('TRACKING_SECRET (or ENCRYPTION_KEY) must be set')
}

export function getTrackingBaseUrl(): string {
  return (process.env.TRACKING_URL || process.env.APP_URL || '').replace(/\/$/, '')
}

export function signTrackingPayload(payload: string): string {
  const sig = createHmac('sha256', getSecret()).update(payload).digest('hex').slice(0, SIG_LENGTH)
  return `${payload}.${sig}`
}

export function verifyTrackingPayload(token: string): string | null {
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!payload || sig.length !== SIG_LENGTH) return null
  const expected = createHmac('sha256', getSecret()).update(payload).digest('hex').slice(0, SIG_LENGTH)
  const a = Buffer.from(sig, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return null
  return timingSafeEqual(a, b) ? payload : null
}

export function buildClickUrl(trackingBaseUrl: string, sendId: string, url: string): string {
  const payload = Buffer.from(JSON.stringify({ sendId, url }), 'utf8').toString('base64url')
  const signed = signTrackingPayload(payload)
  return `${trackingBaseUrl}/r/${signed}`
}
