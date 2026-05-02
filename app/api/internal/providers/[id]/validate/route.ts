import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emailProviders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createProviderAdapter } from '@/lib/providers/factory'
import { logger, trackEvent, trackError } from '@/lib/logger'
import { auditFromSession, logAudit } from '@/lib/audit'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  logger.info({ providerId: params.id }, 'Provider validation requested')

  try {
    const [provider] = await db
      .select()
      .from(emailProviders)
      .where(eq(emailProviders.id, params.id))

    if (!provider) {
      logger.warn({ providerId: params.id }, 'Provider not found for validation')
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    logger.info({ providerId: params.id, type: provider.type, name: provider.name }, 'Validating provider connection')
    const adapter = createProviderAdapter(provider.type, provider.configEncrypted)
    const valid = await adapter.validate()
    const durationMs = Date.now() - startTime

    logger.info({ providerId: params.id, valid, durationMs }, 'Provider validation complete')
    trackEvent('provider_validation_complete', {
      providerId: params.id,
      providerType: provider.type,
      valid,
      durationMs,
    })

    await logAudit(
      await auditFromSession(req),
      'provider.validate',
      { type: 'provider', id: params.id },
      { valid, providerType: provider.type },
    )

    return NextResponse.json({ valid })
  } catch (err) {
    const durationMs = Date.now() - startTime
    const message = err instanceof Error ? err.message : 'Validation failed'
    logger.error({ err, providerId: params.id, durationMs }, 'Provider validation error')
    trackError(err, { action: 'validate_provider', providerId: params.id, durationMs })
    return NextResponse.json({ valid: false, error: message })
  }
}
