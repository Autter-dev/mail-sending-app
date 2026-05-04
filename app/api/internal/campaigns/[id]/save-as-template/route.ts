import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { campaigns, templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { auditFromSession, logAudit } from '@/lib/audit'
import { saveAsTemplateSchema } from '@/lib/validations/templates'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = saveAsTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { name, description } = parsed.data

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, params.id))

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  const [created] = await db
    .insert(templates)
    .values({
      name,
      description: description ?? null,
      subject: campaign.subject,
      fromName: campaign.fromName,
      fromEmail: campaign.fromEmail,
      templateJson: campaign.templateJson,
      templateHtml: campaign.templateHtml,
    })
    .returning()

  await logAudit(
    await auditFromSession(req),
    'template.create_from_campaign',
    { type: 'template', id: created.id },
    { campaignId: campaign.id, name: created.name },
  )

  return NextResponse.json(created, { status: 201 })
}
