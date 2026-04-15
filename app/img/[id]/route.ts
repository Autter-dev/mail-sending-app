import { NextRequest, NextResponse } from 'next/server'
import { getFile } from '@/lib/storage'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Validate filename format to prevent path traversal
  if (!/^[\w-]+\.\w+$/.test(params.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const key = `images/${params.id}`

  try {
    const file = await getFile(key)
    if (!file.body) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const bytes = await file.body.transformToByteArray()

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
