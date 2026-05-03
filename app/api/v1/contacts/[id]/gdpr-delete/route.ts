import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { hardDeleteContact } from '@/lib/gdpr'
import { withApiAuth } from '@/lib/api-auth'
import { auditFromApiKey, logAudit } from '@/lib/audit'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return withApiAuth(req, async (auth) => {
    const confirm = req.nextUrl.searchParams.get('confirm')
    if (!confirm) {
      return NextResponse.json(
        { error: 'Pass ?confirm=<contact_email> to confirm the hard delete.', data: null, meta: {} },
        { status: 400 },
      )
    }

    const [existing] = await db.select().from(contacts).where(eq(contacts.id, params.id))
    if (!existing) {
      return NextResponse.json({ error: 'Contact not found', data: null, meta: {} }, { status: 404 })
    }

    if (existing.email.toLowerCase() !== confirm.toLowerCase()) {
      return NextResponse.json(
        { error: 'Confirmation email does not match the contact on file.', data: null, meta: {} },
        { status: 400 },
      )
    }

    const result = await hardDeleteContact(params.id)
    if (!result) {
      return NextResponse.json({ error: 'Contact not found', data: null, meta: {} }, { status: 404 })
    }

    await logAudit(
      auditFromApiKey(req, auth),
      'contact.gdpr_delete',
      { type: 'contact', id: params.id },
      {
        email: result.email,
        listId: result.listId,
        sendCount: result.sendCount,
        eventCount: result.eventCount,
      },
    )

    return NextResponse.json({
      data: {
        deleted: true,
        sendCount: result.sendCount,
        eventCount: result.eventCount,
      },
      meta: {},
      error: null,
    })
  })
}
