import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { templates } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { auditFromSession, logAudit } from '@/lib/audit'
import { updateTemplateSchema } from '@/lib/validations/templates'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const [template] = await db
    .select()
    .from(templates)
    .where(eq(templates.id, params.id))

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  return NextResponse.json(template)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updateTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields provided for update' },
      { status: 400 }
    )
  }

  const [updated] = await db
    .update(templates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(templates.id, params.id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  await logAudit(
    await auditFromSession(req),
    'template.update',
    { type: 'template', id: updated.id },
    { fields: Object.keys(data) },
  )

  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const [deleted] = await db
    .delete(templates)
    .where(eq(templates.id, params.id))
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  await logAudit(
    await auditFromSession(req),
    'template.delete',
    { type: 'template', id: deleted.id },
    { name: deleted.name },
  )

  return NextResponse.json({ success: true })
}
