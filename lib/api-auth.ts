import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export async function authenticateApiKey(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const rawKey = auth.slice(7)

  const allKeys = await db.select().from(apiKeys)
  for (const key of allKeys) {
    const valid = await bcrypt.compare(rawKey, key.keyHash)
    if (valid) {
      await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id))
      return true
    }
  }
  return false
}
