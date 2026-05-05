import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/auth-helpers'
import { desc } from 'drizzle-orm'

export async function GET() {
  const guard = await requireAdmin()
  if (guard) return guard

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))

  return NextResponse.json(rows)
}
