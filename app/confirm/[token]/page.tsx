import { db } from '@/lib/db'
import { contacts, lists } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import Image from 'next/image'
import { redirect } from 'next/navigation'

async function getContactByConfirmationToken(token: string) {
  const result = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      status: contacts.status,
      confirmationToken: contacts.confirmationToken,
      listId: contacts.listId,
      listName: lists.name,
    })
    .from(contacts)
    .innerJoin(lists, eq(contacts.listId, lists.id))
    .where(eq(contacts.confirmationToken, token))
    .limit(1)

  return result[0] || null
}

async function confirmAction(formData: FormData) {
  'use server'

  const token = formData.get('token') as string
  if (!token) return

  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.confirmationToken, token),
  })

  if (!contact || contact.status !== 'pending') return

  await db
    .update(contacts)
    .set({ status: 'active', confirmationToken: null, updatedAt: new Date() })
    .where(eq(contacts.id, contact.id))

  redirect(`/confirm/${token}?confirmed=1`)
}

export default async function ConfirmPage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams: { confirmed?: string }
}) {
  const { token } = params
  const appName = process.env.APP_NAME || 'hedwig'
  const justConfirmed = searchParams.confirmed === '1'

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(token)) {
    return (
      <ConfirmLayout appName={appName}>
        <h1 className="text-xl font-semibold font-heading text-foreground mb-2">Invalid Link</h1>
        <p className="text-muted-foreground">
          This confirmation link is invalid or has already been used.
        </p>
      </ConfirmLayout>
    )
  }

  const contact = await getContactByConfirmationToken(token)

  if (!contact) {
    if (justConfirmed) {
      return (
        <ConfirmLayout appName={appName}>
          <h1 className="text-xl font-semibold font-heading text-foreground mb-2">Subscription Confirmed</h1>
          <p className="text-muted-foreground">
            Thanks, you are now subscribed.
          </p>
        </ConfirmLayout>
      )
    }
    return (
      <ConfirmLayout appName={appName}>
        <h1 className="text-xl font-semibold font-heading text-foreground mb-2">Invalid Link</h1>
        <p className="text-muted-foreground">
          This confirmation link is invalid or has already been used.
        </p>
      </ConfirmLayout>
    )
  }

  if (contact.status === 'active') {
    return (
      <ConfirmLayout appName={appName}>
        <h1 className="text-xl font-semibold font-heading text-foreground mb-2">Already Confirmed</h1>
        <p className="text-muted-foreground">
          <span className="font-medium">{contact.email}</span> is already subscribed
          to <span className="font-medium">{contact.listName}</span>.
        </p>
      </ConfirmLayout>
    )
  }

  if (contact.status !== 'pending') {
    return (
      <ConfirmLayout appName={appName}>
        <h1 className="text-xl font-semibold font-heading text-foreground mb-2">Invalid Link</h1>
        <p className="text-muted-foreground">
          This link is no longer active.
        </p>
      </ConfirmLayout>
    )
  }

  return (
    <ConfirmLayout appName={appName}>
      <h1 className="text-xl font-semibold font-heading text-foreground mb-2">Confirm Subscription</h1>
      <p className="text-muted-foreground mb-6">
        Click below to confirm{' '}
        <span className="font-medium">{contact.email}</span> for{' '}
        <span className="font-medium">{contact.listName}</span>.
      </p>
      <form action={confirmAction}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Confirm Subscription
        </button>
      </form>
    </ConfirmLayout>
  )
}

function ConfirmLayout({
  appName,
  children,
}: {
  appName: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl shadow-warm border p-8 text-center">
          <Image
            src="/assets/logo/primary-logo.png"
            alt={appName}
            width={200}
            height={87}
            priority
            className="mx-auto mb-6 h-16 w-auto dark:invert"
          />
          {children}
        </div>
      </div>
    </div>
  )
}
