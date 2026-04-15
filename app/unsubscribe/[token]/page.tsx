import { db } from '@/lib/db'
import { contacts, lists, campaignSends, campaignEvents } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { redirect } from 'next/navigation'

async function getContactByToken(token: string) {
  const result = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      status: contacts.status,
      unsubscribeToken: contacts.unsubscribeToken,
      listId: contacts.listId,
      listName: lists.name,
    })
    .from(contacts)
    .innerJoin(lists, eq(contacts.listId, lists.id))
    .where(eq(contacts.unsubscribeToken, token))
    .limit(1)

  return result[0] || null
}

async function unsubscribeAction(formData: FormData) {
  'use server'

  const token = formData.get('token') as string
  if (!token) return

  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.unsubscribeToken, token),
  })

  if (!contact || contact.status === 'unsubscribed') return

  await db
    .update(contacts)
    .set({ status: 'unsubscribed', updatedAt: new Date() })
    .where(eq(contacts.id, contact.id))

  // Find the most recent campaign send for this contact and log the event
  const recentSend = await db
    .select()
    .from(campaignSends)
    .where(eq(campaignSends.contactId, contact.id))
    .orderBy(desc(campaignSends.createdAt))
    .limit(1)

  if (recentSend[0]) {
    await db.insert(campaignEvents).values({
      campaignSendId: recentSend[0].id,
      campaignId: recentSend[0].campaignId,
      type: 'unsubscribe',
    })
  }

  redirect(`/unsubscribe/${token}`)
}

export default async function UnsubscribePage({
  params,
}: {
  params: { token: string }
}) {
  const { token } = params
  const appName = process.env.APP_NAME || 'Mailpost'

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(token)) {
    return (
      <UnsubscribeLayout appName={appName}>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Invalid Link</h1>
        <p className="text-slate-600">
          This link is invalid or has already been used.
        </p>
      </UnsubscribeLayout>
    )
  }

  const contact = await getContactByToken(token)

  if (!contact) {
    return (
      <UnsubscribeLayout appName={appName}>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Invalid Link</h1>
        <p className="text-slate-600">
          This link is invalid or has already been used.
        </p>
      </UnsubscribeLayout>
    )
  }

  if (contact.status === 'unsubscribed') {
    return (
      <UnsubscribeLayout appName={appName}>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Already Unsubscribed</h1>
        <p className="text-slate-600">
          <span className="font-medium">{contact.email}</span> is already unsubscribed
          from <span className="font-medium">{contact.listName}</span>.
        </p>
      </UnsubscribeLayout>
    )
  }

  return (
    <UnsubscribeLayout appName={appName}>
      <h1 className="text-xl font-semibold text-slate-900 mb-2">Unsubscribe</h1>
      <p className="text-slate-600 mb-6">
        Are you sure you want to unsubscribe{' '}
        <span className="font-medium">{contact.email}</span> from{' '}
        <span className="font-medium">{contact.listName}</span>?
      </p>
      <form action={unsubscribeAction}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-slate-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
        >
          Confirm Unsubscribe
        </button>
      </form>
    </UnsubscribeLayout>
  )
}

function UnsubscribeLayout({
  appName,
  children,
}: {
  appName: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wide mb-6">
            {appName}
          </p>
          {children}
        </div>
      </div>
    </div>
  )
}
