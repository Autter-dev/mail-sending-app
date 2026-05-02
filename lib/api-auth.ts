import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { consumeApiKeyToken, type RateLimitResult } from '@/lib/rate-limit'

export interface ApiAuthContext {
  keyId: string
  keyName: string
}

export async function authenticateApiKey(req: NextRequest): Promise<ApiAuthContext | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const rawKey = auth.slice(7)

  const allKeys = await db.select().from(apiKeys)
  for (const key of allKeys) {
    const valid = await bcrypt.compare(rawKey, key.keyHash)
    if (valid) {
      await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id))
      return { keyId: key.id, keyName: key.name }
    }
  }
  return null
}

function rateLimitHeaders(rl: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(rl.limit),
    'X-RateLimit-Remaining': String(rl.remaining),
    'X-RateLimit-Reset': String(rl.resetSeconds),
  }
}

function v1ErrorResponse(status: number, error: string, headers?: Record<string, string>) {
  return NextResponse.json(
    { data: null, meta: {}, error },
    { status, headers },
  )
}

/**
 * Wraps a v1 API route handler with API key auth + per-key rate limiting.
 * On success, calls the handler with `auth` and decorates the response with X-RateLimit-* headers.
 */
export async function withApiAuth(
  req: NextRequest,
  handler: (auth: ApiAuthContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  const auth = await authenticateApiKey(req)
  if (!auth) {
    return v1ErrorResponse(401, 'Unauthorized')
  }

  const rl = await consumeApiKeyToken(auth.keyId)
  const headers = rateLimitHeaders(rl)

  if (!rl.allowed) {
    return v1ErrorResponse(429, 'Rate limit exceeded', {
      ...headers,
      'Retry-After': String(rl.resetSeconds),
    })
  }

  const res = await handler(auth)
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v)
  }
  return res
}
