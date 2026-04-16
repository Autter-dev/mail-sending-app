import { decrypt } from '@/lib/encryption'
import { ResendAdapter } from './resend'
import { SESAdapter } from './ses'
import type { EmailProviderAdapter, ProviderConfig } from './types'
import { logger, trackError } from '@/lib/logger'

export function createProviderAdapter(type: string, configEncrypted: string): EmailProviderAdapter {
  logger.info({ type }, 'Creating email provider adapter')
  try {
    const config: ProviderConfig = JSON.parse(decrypt(configEncrypted))
    logger.debug({ type }, 'Provider config decrypted successfully')

    if (type === 'resend') return new ResendAdapter(config)
    if (type === 'ses') return new SESAdapter(config)

    const err = new Error(`Unknown provider type: ${type}`)
    logger.error({ type }, 'Unknown provider type')
    trackError(err, { action: 'create_adapter', type })
    throw err
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Unknown provider type')) throw err
    logger.error({ err, type }, 'Failed to create provider adapter (config decryption or parsing failed)')
    trackError(err, { action: 'create_adapter', type })
    throw err
  }
}
