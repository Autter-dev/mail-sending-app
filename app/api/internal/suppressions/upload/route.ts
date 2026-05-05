import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { uploadFile } from '@/lib/storage'
import { requireAdmin } from '@/lib/auth-helpers'

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard) return guard

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Failed to parse form data' }, { status: 400 })
  }

  const file = formData.get('file') as Blob | null
  const filename = (formData.get('filename') as string | null) ?? ''
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: 'File is empty or could not be parsed' }, { status: 400 })
  }

  const headers = rows[0] as string[]
  const preview = rows.slice(1, 6) as string[][]

  const s3Key = `uploads/suppressions/${Date.now()}.xlsx`
  await uploadFile(s3Key, buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

  return NextResponse.json({ headers, preview, s3Key, filename })
}
