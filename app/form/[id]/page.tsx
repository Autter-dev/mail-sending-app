import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import Image from 'next/image'
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
  const appName = process.env.APP_NAME || 'hedwig'

  const logoSrc = form.brandingLogoFileId
    ? `/img/${form.brandingLogoFileId}`
    : '/assets/logo/primary-logo.png'
  const customLogo = !!form.brandingLogoFileId
  const primaryColor = form.brandingPrimaryColor
  const bgColor = form.brandingBgColor
  const textColor = form.brandingTextColor

  if (embed) {
    return (
      <div className="p-4" style={{ backgroundColor: bgColor ?? undefined, color: textColor ?? undefined }}>
        <FormClient
          formId={form.id}
          name={form.name}
          fields={form.fields}
          successMessage={form.successMessage}
          redirectUrl={form.redirectUrl}
          primaryColor={primaryColor}
          textColor={textColor}
        />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center p-4"
      style={{ backgroundColor: bgColor ?? undefined, color: textColor ?? undefined }}
    >
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl shadow-warm border p-8">
          {customLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt={appName}
              className="mb-4 h-12 w-auto"
            />
          ) : (
            <Image
              src={logoSrc}
              alt={appName}
              width={720}
              height={345}
              priority
              unoptimized
              className="mb-4 h-12 w-auto"
            />
          )}
          <h1
            className="text-xl font-semibold font-heading text-foreground mb-6"
            style={{ color: textColor ?? undefined }}
          >
            {form.name}
          </h1>
          <FormClient
            formId={form.id}
            name={form.name}
            fields={form.fields}
            successMessage={form.successMessage}
            redirectUrl={form.redirectUrl}
            primaryColor={primaryColor}
            textColor={textColor}
          />
        </div>
      </div>
    </div>
  )
}
