import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaigns, emailProviders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createProviderAdapter } from '@/lib/providers/factory'
import { renderTemplate } from '@/lib/renderer'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { toEmail } = body

    if (!toEmail || typeof toEmail !== 'string') {
      return NextResponse.json(
        { error: 'toEmail is required' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(toEmail)) {
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
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (!campaign.providerId) {
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
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 400 }
      )
    }

    const adapter = createProviderAdapter(provider.type, provider.configEncrypted)

    const html = renderTemplate({
      blocks: campaign.templateJson,
      contact: { email: toEmail, first_name: 'Test', last_name: 'User', unsubscribe_url: '#' },
      sendId: 'test-' + Date.now(),
      appUrl: process.env.APP_URL!,
      unsubscribeUrl: '#',
      rawHtml: campaign.templateHtml,
    })

    await adapter.send({
      to: toEmail,
      from: campaign.fromEmail,
      fromName: campaign.fromName,
      subject: campaign.subject || 'Test Email',
      html,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send test email'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
