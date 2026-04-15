import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emailProviders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createProviderAdapter } from '@/lib/providers/factory'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [provider] = await db
      .select()
      .from(emailProviders)
      .where(eq(emailProviders.id, params.id))

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    const adapter = createProviderAdapter(provider.type, provider.configEncrypted)
    const valid = await adapter.validate()

    return NextResponse.json({ valid })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Validation failed'
    return NextResponse.json({ valid: false, error: message })
  }
}
