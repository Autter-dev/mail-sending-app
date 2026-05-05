import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { SubmissionsClient } from './client'

export const dynamic = 'force-dynamic'

export default async function FormSubmissionsPage({ params }: { params: { id: string } }) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(params.id)) notFound()

  const [form] = await db.select().from(forms).where(eq(forms.id, params.id))
  if (!form) notFound()

  return <SubmissionsClient formId={form.id} formName={form.name} fields={form.fields} />
}
