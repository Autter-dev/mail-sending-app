import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api-auth'
import { unsuppressEmailById } from '@/lib/suppressions'
import { auditFromApiKey, logAudit } from '@/lib/audit'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withApiAuth(req, async (auth) => {
    const removed = await unsuppressEmailById(params.id)
    if (!removed) {
      return NextResponse.json({ error: 'Suppression not found', data: null, meta: {} }, { status: 404 })
    }

    await logAudit(
      auditFromApiKey(req, auth),
      'suppression.delete',
      { type: 'suppression', id: params.id },
      { email: removed.email },
    )

    return NextResponse.json({ data: { id: params.id, removed: true }, meta: {}, error: null })
  })
}
