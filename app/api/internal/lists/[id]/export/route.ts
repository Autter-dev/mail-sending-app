import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.listId, params.id))
    .orderBy(contacts.createdAt)

  const header = 'email,first_name,last_name,status'

  const lines = rows.map((contact) => {
    const email = csvEscape(contact.email)
    const firstName = csvEscape(contact.firstName ?? '')
    const lastName = csvEscape(contact.lastName ?? '')
    const status = csvEscape(contact.status)
    return `${email},${firstName},${lastName},${status}`
  })

  const csv = [header, ...lines].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="contacts.csv"',
      'Cache-Control': 'no-store',
    },
  })
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
