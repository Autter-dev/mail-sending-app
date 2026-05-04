import { db } from '@/lib/db'
import { contacts, lists } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

async function findContact(token: string) {
  const [row] = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      status: contacts.status,
      listName: lists.name,
    })
    .from(contacts)
    .innerJoin(lists, eq(lists.id, contacts.listId))
    .where(eq(contacts.confirmationToken, token))
    .limit(1)
  return row || null
}

async function confirmAction(formData: FormData) {
  'use server'
  const token = formData.get('token') as string
  if (!token) return

  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.confirmationToken, token),
  })
  if (!contact) return
  if (contact.status !== 'pending') return

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
  const appName = process.env.APP_NAME || 'Mailpost'
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  if (!uuidRegex.test(token)) {
    return (
      <Layout appName={appName}>
        <h1 className="text-xl font-semibold font-heading text-foreground mb-2">Invalid Link</h1>
        <p className="text-muted-foreground">This link is invalid or has expired.</p>
      </Layout>
    )
  }

  const contact = await findContact(token)

  if (!contact) {
    if (searchParams?.confirmed === '1') {
      return (
        <Layout appName={appName}>
          <h1 className="text-xl font-semibold font-heading text-foreground mb-2">You&apos;re confirmed</h1>
          <p className="text-muted-foreground">Thanks for confirming your subscription.</p>
        </Layout>
      )
    }
    return (
      <Layout appName={appName}>
        <h1 className="text-xl font-semibold font-heading text-foreground mb-2">Invalid Link</h1>
        <p className="text-muted-foreground">This link is invalid or has expired.</p>
      </Layout>
    )
  }

  if (contact.status === 'active') {
    return (
      <Layout appName={appName}>
        <h1 className="text-xl font-semibold font-heading text-foreground mb-2">Already confirmed</h1>
        <p className="text-muted-foreground">
          <span className="font-medium">{contact.email}</span> is confirmed for{' '}
          <span className="font-medium">{contact.listName}</span>.
        </p>
      </Layout>
    )
  }

  if (contact.status !== 'pending') {
    return (
      <Layout appName={appName}>
        <h1 className="text-xl font-semibold font-heading text-foreground mb-2">Invalid Link</h1>
        <p className="text-muted-foreground">This link is invalid or has expired.</p>
      </Layout>
    )
  }

  return (
    <Layout appName={appName}>
      <h1 className="text-xl font-semibold font-heading text-foreground mb-2">Confirm your subscription</h1>
      <p className="text-muted-foreground mb-6">
        Confirm <span className="font-medium">{contact.email}</span> for{' '}
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
    </Layout>
  )
}

function Layout({ appName, children }: { appName: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-xl shadow-warm border p-8 text-center">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-6">
            {appName}
          </p>
          {children}
        </div>
      </div>
    </div>
  )
}
