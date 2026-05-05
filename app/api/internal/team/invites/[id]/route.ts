import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { teamInvites } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/auth-helpers'
import { auditFromSession, logAudit } from '@/lib/audit'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const guard = await requireAdmin()
  if (guard) return guard

  const invite = await db.query.teamInvites.findFirst({ where: eq(teamInvites.id, params.id) })
  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  if (invite.acceptedAt) {
    return NextResponse.json({ error: 'Invite already accepted' }, { status: 400 })
  }

  await db
    .update(teamInvites)
    .set({ revokedAt: new Date() })
    .where(eq(teamInvites.id, params.id))

  await logAudit(
    await auditFromSession(req),
    'team.invite.revoked',
    { type: 'team_invite', id: invite.id },
    { email: invite.email, role: invite.role },
  )

  return NextResponse.json({ success: true })
}
