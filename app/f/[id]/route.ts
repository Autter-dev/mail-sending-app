import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assets } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getFile } from '@/lib/storage'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!/^[\w-]+\.\w+$/.test(params.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.fileId, params.id))

  if (!asset) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const file = await getFile(asset.s3Key)
    if (!file.body) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const bytes = await file.body.transformToByteArray()
    const downloadName = asset.originalName.replace(/[^\w. -]/g, '_')

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': asset.mimeType || file.contentType,
        'Content-Disposition': `inline; filename="${downloadName}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
