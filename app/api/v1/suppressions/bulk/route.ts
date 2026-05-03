import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api-auth'
import { bulkSuppressionsSchema } from '@/lib/validations/suppressions'
import { suppressEmailsBulk, type SuppressInput } from '@/lib/suppressions'

export async function POST(req: NextRequest) {
  if (!(await authenticateApiKey(req))) {
    return NextResponse.json({ error: 'Unauthorized', data: null, meta: {} }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', data: null, meta: {} }, { status: 400 })
  }

  const parsed = bulkSuppressionsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', data: null, meta: { details: parsed.error.flatten() } },
      { status: 400 }
    )
  }

  const inputs: SuppressInput[] = parsed.data.emails.map((entry) => ({
    email: entry.email,
    reason: entry.reason ?? 'manual',
    source: entry.source ?? 'api-bulk',
    metadata: entry.metadata,
  }))

  const result = await suppressEmailsBulk(inputs)
  return NextResponse.json({ data: result, meta: { submitted: inputs.length }, error: null }, { status: 201 })
}
