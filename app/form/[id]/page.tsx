import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { FormClient } from './form-client'

export const dynamic = 'force-dynamic'

export default async function HostedFormPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { embed?: string }
}) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(params.id)) notFound()

  const [form] = await db.select().from(forms).where(eq(forms.id, params.id))
  if (!form) notFound()

  const embed = searchParams?.embed === '1'
  const appName = process.env.APP_NAME || 'hedwig-mail'

  if (embed) {
    return (
      <div className="p-4">
        <FormClient
          formId={form.id}
          name={form.name}
          fields={form.fields}
          successMessage={form.successMessage}
          redirectUrl={form.redirectUrl}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl shadow-warm border p-8">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
            {appName}
          </p>
          <h1 className="text-xl font-semibold font-heading text-foreground mb-6">{form.name}</h1>
          <FormClient
            formId={form.id}
            name={form.name}
            fields={form.fields}
            successMessage={form.successMessage}
            redirectUrl={form.redirectUrl}
          />
        </div>
      </div>
    </div>
  )
}
