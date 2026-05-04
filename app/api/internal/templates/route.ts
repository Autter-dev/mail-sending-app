import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { templates, campaigns } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { auditFromSession, logAudit } from '@/lib/audit'
import { createTemplateSchema } from '@/lib/validations/templates'

export async function GET() {
  const rows = await db
    .select()
    .from(templates)
    .orderBy(desc(templates.updatedAt))

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { name, description, fromCampaignId } = parsed.data

  let snapshot = {
    subject: '',
    fromName: '',
    fromEmail: '',
    templateJson: [] as never[],
    templateHtml: null as string | null,
  }

  if (fromCampaignId) {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, fromCampaignId))
    if (!campaign) {
      return NextResponse.json({ error: 'Source campaign not found' }, { status: 404 })
    }
    snapshot = {
      subject: campaign.subject,
      fromName: campaign.fromName,
      fromEmail: campaign.fromEmail,
      templateJson: campaign.templateJson as never[],
      templateHtml: campaign.templateHtml,
    }
  }

  const [created] = await db
    .insert(templates)
    .values({
      name,
      description: description ?? null,
      ...snapshot,
    })
    .returning()

  await logAudit(
    await auditFromSession(req),
    'template.create',
    { type: 'template', id: created.id },
    { name: created.name, fromCampaignId: fromCampaignId ?? null },
  )

  return NextResponse.json(created, { status: 201 })
}
