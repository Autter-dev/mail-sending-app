import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emailProviders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { decrypt } from '@/lib/encryption'
import { auditFromSession, logAudit } from '@/lib/audit'

interface ProviderConfig {
  apiKey?: string
  region?: string
}

function safeProviderView(provider: typeof emailProviders.$inferSelect) {
  let maskedKey: string | undefined
  let region: string | undefined

  try {
    const config: ProviderConfig = JSON.parse(decrypt(provider.configEncrypted))

    if (provider.type === 'resend' && config.apiKey) {
      const last4 = config.apiKey.slice(-4)
      maskedKey = `****${last4}`
    } else if (provider.type === 'ses') {
      region = config.region
      if (config.apiKey) {
        const accessKeyId = config.apiKey.split(':')[0] ?? ''
        const last4 = accessKeyId.slice(-4)
        maskedKey = `****${last4}`
      }
    }
  } catch {
    // Config decryption failed: return provider without key details
  }

  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    isDefault: provider.isDefault,
    rateLimitPerSecond: provider.rateLimitPerSecond,
    createdAt: provider.createdAt,
    ...(maskedKey !== undefined ? { maskedKey } : {}),
    ...(region !== undefined ? { region } : {}),
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [existing] = await db.select().from(emailProviders).where(eq(emailProviders.id, params.id))
    await db.delete(emailProviders).where(eq(emailProviders.id, params.id))
    if (existing) {
      await logAudit(
        await auditFromSession(req),
        'provider.delete',
        { type: 'provider', id: params.id },
        { name: existing.name, providerType: existing.type },
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete provider'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { isDefault } = body as { isDefault?: boolean }

  if (typeof isDefault !== 'boolean') {
    return NextResponse.json({ error: 'isDefault must be a boolean' }, { status: 400 })
  }

  try {
    if (isDefault) {
      // Unset all providers first, then set this one as default
      await db.update(emailProviders).set({ isDefault: false })
      await db
        .update(emailProviders)
        .set({ isDefault: true })
        .where(eq(emailProviders.id, params.id))
    } else {
      await db
        .update(emailProviders)
        .set({ isDefault: false })
        .where(eq(emailProviders.id, params.id))
    }

    const [updated] = await db
      .select()
      .from(emailProviders)
      .where(eq(emailProviders.id, params.id))

    if (!updated) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    await logAudit(
      await auditFromSession(req),
      isDefault ? 'provider.set_default' : 'provider.unset_default',
      { type: 'provider', id: updated.id },
      { name: updated.name },
    )

    return NextResponse.json(safeProviderView(updated))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update provider'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
