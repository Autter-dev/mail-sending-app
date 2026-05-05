import { NextRequest, NextResponse } from 'next/server'
import { unsuppressEmailById } from '@/lib/suppressions'
import { auditFromSession, logAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth-helpers'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin()
  if (guard) return guard

  const removed = await unsuppressEmailById(params.id)
  if (!removed) {
    return NextResponse.json({ error: 'Suppression not found' }, { status: 404 })
  }

  await logAudit(
    await auditFromSession(req),
    'suppression.delete',
    { type: 'suppression', id: params.id },
    { email: removed.email },
  )

  return NextResponse.json({ success: true })
}
