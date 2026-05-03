import { NextRequest, NextResponse } from 'next/server'
import { buildContactExport } from '@/lib/gdpr'
import { auditFromSession, logAudit } from '@/lib/audit'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const data = await buildContactExport(params.id)
  if (!data) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  await logAudit(
    await auditFromSession(req),
    'contact.gdpr_export',
    { type: 'contact', id: params.id },
    { sendCount: data.sends.length, eventCount: data.events.length },
  )

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="contact-${params.id}-export.json"`,
    },
  })
}
