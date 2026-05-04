import { NextRequest, NextResponse } from 'next/server'
import { uploadFile } from '@/lib/storage'
import { db } from '@/lib/db'
import { assets } from '@/lib/db/schema'
import { nanoid } from 'nanoid'

// Allow file uploads up to 10MB
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed. Use PNG, JPEG, GIF, WebP, or SVG.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    const ext = file.name.split('.').pop() || 'png'
    const fileId = `${nanoid(12)}.${ext}`
    const key = `images/${fileId}`

    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadFile(key, buffer, file.type)

    await db.insert(assets).values({
      fileId,
      name: file.name,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      s3Key: key,
      kind: 'image',
    })

    // Public URL served through our proxy route (no expiry, clean URL)
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const url = `${appUrl}/img/${fileId}`

    return NextResponse.json({ key, url }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
