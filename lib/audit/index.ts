import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'
import { authOptions } from '@/lib/auth'
import type { ApiAuthContext } from '@/lib/api-auth'

export type ActorType = 'user' | 'api_key' | 'system'

export interface AuditContext {
  actorType: ActorType
  actorId?: string | null
  actorLabel?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface AuditResource {
  type: string
  id?: string | null
}

function extractRequestMeta(req: NextRequest | null) {
  if (!req) return { ipAddress: null, userAgent: null }
  return {
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: req.headers.get('user-agent') ?? null,
  }
}

export async function logAudit(
  ctx: AuditContext,
  action: string,
  resource: AuditResource | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorType: ctx.actorType,
      actorId: ctx.actorId ?? null,
      actorLabel: ctx.actorLabel ?? null,
      action,
      resourceType: resource?.type ?? null,
      resourceId: resource?.id ?? null,
      metadata,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
    })
  } catch (err) {
    console.error('audit log insert failed', { action, err })
  }
}

/**
 * Build audit context from a session-protected internal route. Falls back to actorType: 'system'
 * if there's no session (e.g. middleware was bypassed). Never throws.
 */
export async function auditFromSession(req: NextRequest): Promise<AuditContext> {
  const meta = extractRequestMeta(req)
  try {
    const session = await getServerSession(authOptions)
    const email = session?.user?.email
    if (email) {
      return {
        actorType: 'user',
        actorId: email,
        actorLabel: email,
        ...meta,
      }
    }
  } catch {
    // ignore session resolution failure
  }
  return {
    actorType: 'system',
    actorId: null,
    actorLabel: null,
    ...meta,
  }
}

export function auditFromApiKey(req: NextRequest, auth: ApiAuthContext): AuditContext {
  const meta = extractRequestMeta(req)
  return {
    actorType: 'api_key',
    actorId: auth.keyId,
    actorLabel: auth.keyName,
    ...meta,
  }
}

export function systemAuditCtx(req?: NextRequest, label = 'system'): AuditContext {
  const meta = req ? extractRequestMeta(req) : { ipAddress: null, userAgent: null }
  return {
    actorType: 'system',
    actorId: null,
    actorLabel: label,
    ...meta,
  }
}
