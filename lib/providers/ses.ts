import { SESClient, SendEmailCommand, GetAccountSendingEnabledCommand } from '@aws-sdk/client-ses'
import type { EmailProviderAdapter, SendOptions, ProviderConfig } from './types'

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
  }

  async send(options: SendOptions): Promise<{ messageId: string }> {
    const result = await this.client.send(new SendEmailCommand({
      Source: `${options.fromName} <${options.from}>`,
      Destination: { ToAddresses: [options.to] },
      Message: {
        Subject: { Data: options.subject, Charset: 'UTF-8' },
        Body: { Html: { Data: options.html, Charset: 'UTF-8' } },
      },
    }))
    return { messageId: result.MessageId! }
  }

  async validate(): Promise<boolean> {
    try {
      await this.client.send(new GetAccountSendingEnabledCommand({}))
      return true
    } catch {
      return false
    }
  }
}
