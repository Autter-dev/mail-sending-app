import { db } from '@/lib/db'
import { forms, lists, emailProviders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Builder } from './builder'

export const dynamic = 'force-dynamic'

export default async function FormBuilderPage({ params }: { params: { id: string } }) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(params.id)) notFound()

  const [form] = await db.select().from(forms).where(eq(forms.id, params.id))
  if (!form) notFound()

  const allLists = await db.select({ id: lists.id, name: lists.name }).from(lists).orderBy(lists.name)
  const providers = await db
    .select({ id: emailProviders.id, name: emailProviders.name, isDefault: emailProviders.isDefault })
    .from(emailProviders)

  const appUrl = process.env.APP_URL || ''

  return <Builder form={form} lists={allLists} providers={providers} appUrl={appUrl} />
}
