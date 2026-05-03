import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-auth'
import { unsuppressEmailById } from '@/lib/suppressions'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!(await authenticateApiKey(req))) {
    return NextResponse.json({ error: 'Unauthorized', data: null, meta: {} }, { status: 401 })
  }

  const removed = await unsuppressEmailById(params.id)
  if (!removed) {
    return NextResponse.json({ error: 'Suppression not found', data: null, meta: {} }, { status: 404 })
  }
  return NextResponse.json({ data: { id: params.id, removed: true }, meta: {}, error: null })
}
