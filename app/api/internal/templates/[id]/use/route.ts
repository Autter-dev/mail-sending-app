import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { templates, campaigns, emailProviders, lists } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { auditFromSession, logAudit } from '@/lib/audit'
import { useTemplateSchema } from '@/lib/validations/templates'

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

  const parsed = useTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { name, listId } = parsed.data

  const [template] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, params.id))

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const [list] = await db
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1)
  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 })
  }

  const [defaultProvider] = await db
    .select({ id: emailProviders.id })
    .from(emailProviders)
    .where(eq(emailProviders.isDefault, true))
    .limit(1)

  const [created] = await db
    .insert(campaigns)
    .values({
      name,
      listId,
      status: 'draft',
      subject: template.subject,
      fromName: template.fromName,
      fromEmail: template.fromEmail,
      templateJson: template.templateJson,
      templateHtml: template.templateHtml,
      providerId: defaultProvider?.id ?? null,
    })
    .returning()

  await logAudit(
    await auditFromSession(req),
    'campaign.create_from_template',
    { type: 'campaign', id: created.id },
    { templateId: template.id, templateName: template.name, listId },
  )

  return NextResponse.json(created, { status: 201 })
}
