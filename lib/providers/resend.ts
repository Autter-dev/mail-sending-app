import { Resend } from 'resend'
import type { EmailProviderAdapter, SendOptions, ProviderConfig } from './types'

export class ResendAdapter implements EmailProviderAdapter {
  private client: Resend

  constructor(config: ProviderConfig) {
    this.client = new Resend(config.apiKey!)
  }

  async send(options: SendOptions): Promise<{ messageId: string }> {
    const { data, error } = await this.client.emails.send({
      from: `${options.fromName} <${options.from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      headers: options.headers,
    })
    if (error) throw new Error(error.message)
    return { messageId: data!.id }
  }

  async validate(): Promise<boolean> {
    try {
      await this.client.domains.list()
      return true
    } catch {
      return false
    }
  }
}
