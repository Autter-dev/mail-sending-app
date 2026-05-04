import { NextRequest, NextResponse } from 'next/server'
import { unsuppressEmailById } from '@/lib/suppressions'
import { auditFromSession, logAudit } from '@/lib/audit'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
