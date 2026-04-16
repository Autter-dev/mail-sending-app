import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaigns, emailProviders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createProviderAdapter } from '@/lib/providers/factory'
import { renderTemplate } from '@/lib/renderer'
import { logger, trackEvent, trackError } from '@/lib/logger'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  logger.info({ campaignId: params.id }, 'Test send requested')

  try {
    const body = await req.json()
    const { toEmail } = body

    if (!toEmail || typeof toEmail !== 'string') {
      logger.warn({ campaignId: params.id }, 'Test send missing toEmail')
      return NextResponse.json(
        { error: 'toEmail is required' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(toEmail)) {
      logger.warn({ campaignId: params.id, toEmail }, 'Test send invalid email format')
      return NextResponse.json(
        { error: 'toEmail must be a valid email address' },
        { status: 400 }
      )
    }

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, params.id))

    if (!campaign) {
      logger.warn({ campaignId: params.id }, 'Campaign not found for test send')
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (!campaign.providerId) {
      logger.warn({ campaignId: params.id }, 'No provider configured for test send')
      return NextResponse.json(
        { error: 'No email provider configured' },
        { status: 400 }
      )
    }

    const [provider] = await db
      .select()
      .from(emailProviders)
      .where(eq(emailProviders.id, campaign.providerId))

    if (!provider) {
      logger.warn({ campaignId: params.id, providerId: campaign.providerId }, 'Provider not found for test send')
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 400 }
      )
    }

    // Check that the campaign has some content (blocks or raw HTML)
    const hasContent = (campaign.templateJson && campaign.templateJson.length > 0) ||
      (campaign.templateHtml && campaign.templateHtml.trim().length > 0)
    if (!hasContent) {
      logger.warn({ campaignId: params.id }, 'Campaign has no email body content')
      return NextResponse.json(
        { error: 'Campaign has no email content. Add content in the visual editor or HTML code editor, then save before sending.' },
        { status: 400 }
      )
    }

    logger.info(
      { campaignId: params.id, toEmail, providerType: provider.type, subject: campaign.subject, hasContent },
      'Rendering template and sending test email'
    )

    const adapter = createProviderAdapter(provider.type, provider.configEncrypted)

    // Use a dummy but functional unsubscribe URL for test sends
    const appUrl = process.env.APP_URL!
    const testUnsubscribeUrl = `${appUrl}/unsubscribe/00000000-0000-0000-0000-000000000000`

    const html = renderTemplate({
      blocks: campaign.templateJson,
      contact: { email: toEmail, first_name: 'Test', last_name: 'User', unsubscribe_url: testUnsubscribeUrl },
      sendId: 'test-' + Date.now(),
      appUrl,
      unsubscribeUrl: testUnsubscribeUrl,
      rawHtml: campaign.templateHtml,
    })

    await adapter.send({
      to: toEmail,
      from: campaign.fromEmail,
      fromName: campaign.fromName,
      subject: campaign.subject || 'Test Email',
      html,
    })

    const durationMs = Date.now() - startTime
    logger.info({ campaignId: params.id, toEmail, durationMs }, 'Test email sent successfully')
    trackEvent('test_email_sent', { campaignId: params.id, providerType: provider.type, durationMs })

    return NextResponse.json({ success: true })
  } catch (err) {
    const durationMs = Date.now() - startTime
    const message = err instanceof Error ? err.message : 'Failed to send test email'
    logger.error({ err, campaignId: params.id, durationMs }, 'Test send failed')
    trackError(err, { action: 'test_send', campaignId: params.id, durationMs })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
