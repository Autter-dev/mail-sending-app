import { SESClient, SendEmailCommand, GetAccountSendingEnabledCommand } from '@aws-sdk/client-ses'
import type { EmailProviderAdapter, SendOptions, ProviderConfig } from './types'
import { logger, trackEvent, trackError } from '@/lib/logger'

export class SESAdapter implements EmailProviderAdapter {
  private client: SESClient

  constructor(config: ProviderConfig) {
    this.client = new SESClient({
      region: config.region!,
      credentials: {
        accessKeyId: config.apiKey!.split(':')[0],
        secretAccessKey: config.apiKey!.split(':')[1],
      },
    })
    logger.info({ region: config.region }, 'SESAdapter created')
  }

  async send(options: SendOptions): Promise<{ messageId: string }> {
    const startTime = Date.now()
    logger.info({ to: options.to, from: options.from, subject: options.subject }, 'SES: sending email')

    try {
      const result = await this.client.send(new SendEmailCommand({
        Source: `${options.fromName} <${options.from}>`,
        Destination: { ToAddresses: [options.to] },
        Message: {
          Subject: { Data: options.subject, Charset: 'UTF-8' },
          Body: { Html: { Data: options.html, Charset: 'UTF-8' } },
        },
      }))

      const durationMs = Date.now() - startTime
      logger.info({ to: options.to, messageId: result.MessageId, durationMs }, 'SES: email sent successfully')
      trackEvent('email_sent', { provider: 'ses', durationMs })
      return { messageId: result.MessageId! }
    } catch (err) {
      const durationMs = Date.now() - startTime
      logger.error({ to: options.to, err, durationMs }, 'SES: send failed')
      trackError(err, { provider: 'ses', action: 'send', to: options.to, durationMs })
      throw err
    }
  }

  async validate(): Promise<boolean> {
    const startTime = Date.now()
    logger.info('SES: validating connection')
    try {
      await this.client.send(new GetAccountSendingEnabledCommand({}))
      const durationMs = Date.now() - startTime
      logger.info({ durationMs }, 'SES: validation successful')
      trackEvent('provider_validated', { provider: 'ses', valid: true, durationMs })
      return true
    } catch (err) {
      const durationMs = Date.now() - startTime
      logger.error({ err, durationMs }, 'SES: validation failed')
      trackError(err, { provider: 'ses', action: 'validate', durationMs })
      return false
    }
  }
}
