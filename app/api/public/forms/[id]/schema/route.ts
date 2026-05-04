import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const [form] = await db.select().from(forms).where(eq(forms.id, params.id))
  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404, headers: CORS })
  }
  return NextResponse.json(
    {
      id: form.id,
      name: form.name,
      fields: form.fields,
      successMessage: form.successMessage,
      redirectUrl: form.redirectUrl,
    },
    { headers: { ...CORS, 'Cache-Control': 'public, max-age=60' } },
  )
}
