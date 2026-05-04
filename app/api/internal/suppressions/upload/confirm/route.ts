import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import * as XLSX from 'xlsx'
import { uploadConfirmSchema, SUPPRESSION_REASONS } from '@/lib/validations/suppressions'
import { suppressEmailsBulk, type SuppressInput, type SuppressionReason } from '@/lib/suppressions'
import { auditFromSession, logAudit } from '@/lib/audit'

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

const reasonValues = new Set<string>(SUPPRESSION_REASONS)

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = uploadConfirmSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { s3Key, mapping, filename } = parsed.data

  let buf: Buffer
  try {
    const obj = await s3.send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: s3Key })
    )
    buf = Buffer.from(await obj.Body!.transformToByteArray())
  } catch {
    return NextResponse.json({ error: 'Failed to retrieve file from storage' }, { status: 500 })
  }

  const wb = XLSX.read(buf, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })
  const dataRows = rows.slice(1) as string[][]

  const defaultSource = filename ? `csv:${filename}` : 'csv'
  const inputs: SuppressInput[] = []

  for (const row of dataRows) {
    const emailRaw = row[mapping.email]
    if (!emailRaw || typeof emailRaw !== 'string' || emailRaw.trim() === '') continue

    let reason: SuppressionReason = 'imported'
    if (mapping.reason !== undefined) {
      const raw = row[mapping.reason]
      const candidate = raw ? String(raw).trim().toLowerCase() : ''
      if (reasonValues.has(candidate)) reason = candidate as SuppressionReason
    }

    const sourceCol = mapping.source !== undefined ? row[mapping.source] : undefined
    const source = sourceCol ? String(sourceCol).trim() || defaultSource : defaultSource

    inputs.push({ email: emailRaw, reason, source })
  }

  const result = await suppressEmailsBulk(inputs)

  await logAudit(
    await auditFromSession(request),
    'suppression.bulk_import',
    { type: 'suppression', id: null },
    {
      filename: filename ?? null,
      submitted: inputs.length,
      inserted: result.inserted,
      skipped: result.skipped,
    },
  )

  return NextResponse.json(result)
}
