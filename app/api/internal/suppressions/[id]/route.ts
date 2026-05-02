import { NextResponse } from 'next/server'
import { unsuppressEmailById } from '@/lib/suppressions'

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const removed = await unsuppressEmailById(params.id)
  if (!removed) {
    return NextResponse.json({ error: 'Suppression not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
