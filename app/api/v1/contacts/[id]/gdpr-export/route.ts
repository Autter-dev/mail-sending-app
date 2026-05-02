import { NextRequest, NextResponse } from 'next/server'
import { buildContactExport } from '@/lib/gdpr'
import { withApiAuth } from '@/lib/api-auth'
import { auditFromApiKey, logAudit } from '@/lib/audit'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withApiAuth(req, async (auth) => {
    const data = await buildContactExport(params.id)
    if (!data) {
      return NextResponse.json(
        { error: 'Contact not found', data: null, meta: {} },
        { status: 404 },
      )
    }

    await logAudit(
      auditFromApiKey(req, auth),
      'contact.gdpr_export',
      { type: 'contact', id: params.id },
      { sendCount: data.sends.length, eventCount: data.events.length },
    )

    return NextResponse.json({ data, meta: {}, error: null })
  })
}
