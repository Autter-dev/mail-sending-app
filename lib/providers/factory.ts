import { decrypt } from '@/lib/encryption'
import { ResendAdapter } from './resend'
import { SESAdapter } from './ses'
import type { EmailProviderAdapter, ProviderConfig } from './types'

export function createProviderAdapter(type: string, configEncrypted: string): EmailProviderAdapter {
  const config: ProviderConfig = JSON.parse(decrypt(configEncrypted))
  if (type === 'resend') return new ResendAdapter(config)
  if (type === 'ses') return new SESAdapter(config)
  throw new Error(`Unknown provider type: ${type}`)
}
