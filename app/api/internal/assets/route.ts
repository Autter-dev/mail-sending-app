import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { assets, type Asset } from '@/lib/db/schema'
import { uploadFile } from '@/lib/storage'
import { and, desc, eq, ilike, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { auditFromSession, logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
const FILE_TYPES = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
]
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

function publicUrl(asset: Pick<Asset, 'fileId' | 'kind'>) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  return asset.kind === 'image' ? `${appUrl}/img/${asset.fileId}` : `${appUrl}/f/${asset.fileId}`
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)))
  const kind = url.searchParams.get('kind')
  const search = url.searchParams.get('search')?.trim() || ''

  const filters = []
  if (kind === 'image' || kind === 'file') filters.push(eq(assets.kind, kind))
  if (search) filters.push(ilike(assets.name, `%${search}%`))
  const where = filters.length ? and(...filters) : undefined

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(assets)
    .where(where)

  const rows = await db
    .select()
    .from(assets)
    .where(where)
    .orderBy(desc(assets.createdAt))
    .limit(limit)
    .offset((page - 1) * limit)

  const data = rows.map((row) => ({ ...row, url: publicUrl(row) }))

  return NextResponse.json({ data, meta: { page, limit, total: count } })
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const isImage = IMAGE_TYPES.includes(file.type)
    const isFile = FILE_TYPES.includes(file.type)
    if (!isImage && !isFile) {
      return NextResponse.json(
        { error: 'File type not allowed.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 25MB.' },
        { status: 400 }
      )
    }

    const ext = file.name.split('.').pop() || 'bin'
    const fileId = `${nanoid(12)}.${ext}`
    const folder = isImage ? 'images' : 'files'
    const key = `${folder}/${fileId}`

    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadFile(key, buffer, file.type)

    const [created] = await db
      .insert(assets)
      .values({
        fileId,
        name: file.name,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        s3Key: key,
        kind: isImage ? 'image' : 'file',
      })
      .returning()

    await logAudit(
      await auditFromSession(req),
      'asset.create',
      { type: 'asset', id: created.id },
      { name: created.name, kind: created.kind, size: created.size },
    )

    return NextResponse.json({ ...created, url: publicUrl(created) }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
