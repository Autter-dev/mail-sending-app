import { db } from '@/lib/db'
import { contacts, lists, campaignSends, campaignEvents } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { suppressEmail } from '@/lib/suppressions'
import { logAudit, systemAuditCtx } from '@/lib/audit'
import { PublicPageLayout } from '@/components/public/PublicPageLayout'
import {
  renderUnsubscribeBody,
  renderUnsubscribeTitle,
  type UnsubscribePageVars,
} from '@/lib/settings/unsubscribe-page'
import { getUnsubscribePageContent } from '@/lib/settings/unsubscribe-page-server'
import type { UnsubscribePageStateContent } from '@/lib/db/schema'

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

  await suppressEmail({
    email: contact.email,
    reason: 'unsubscribe',
    source: 'unsubscribe-link',
    metadata: { contactId: contact.id, listId: contact.listId },
  })

  await logAudit(
    systemAuditCtx(undefined, 'unsubscribe-link'),
    'contact.unsubscribed',
    { type: 'contact', id: contact.id },
    {
      email: contact.email,
      listId: contact.listId,
      source: 'one_click',
      campaignId: recentSend[0]?.campaignId ?? null,
    },
  )

  redirect(`/unsubscribe/${token}?confirmed=1`)
}

function StateBlock({
  state,
  vars,
  children,
}: {
  state: UnsubscribePageStateContent
  vars: UnsubscribePageVars
  children?: React.ReactNode
}) {
  const title = renderUnsubscribeTitle(state.title, vars)
  const body = renderUnsubscribeBody(state.body, vars)
  return (
    <>
      <h1 className="text-xl font-semibold font-heading text-foreground mb-2">{title}</h1>
      <div
        className="text-muted-foreground [&_a]:text-primary [&_a]:underline [&_strong]:font-medium [&_strong]:text-foreground"
        dangerouslySetInnerHTML={{ __html: body }}
      />
      {children}
    </>
  )
}

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams: { confirmed?: string }
}) {
  const { token } = params
  const appName = process.env.APP_NAME || 'hedwig'
  const justConfirmed = searchParams.confirmed === '1'

  const content = await getUnsubscribePageContent()

  // Fallback vars when contact lookup fails (invalid link cases)
  const fallbackVars: UnsubscribePageVars = {
    email: '',
    list_name: '',
    app_name: appName,
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(token)) {
    return (
      <PublicPageLayout appName={appName}>
        <StateBlock state={content.invalid} vars={fallbackVars} />
      </PublicPageLayout>
    )
  }

  // Test sends use the all-zero placeholder UUID. Show a friendly state
  // so test recipients see the link works, not "Invalid Link".
  if (token === '00000000-0000-0000-0000-000000000000') {
    return (
      <PublicPageLayout appName={appName}>
        <StateBlock
          state={{
            title: 'Test Email',
            body: 'This was a test send, so no contact is unsubscribed. The link will work for real recipients once the campaign is sent.',
          }}
          vars={fallbackVars}
        />
      </PublicPageLayout>
    )
  }

  const contact = await getContactByToken(token)

  if (!contact) {
    return (
      <PublicPageLayout appName={appName}>
        <StateBlock state={content.invalid} vars={fallbackVars} />
      </PublicPageLayout>
    )
  }

  const vars: UnsubscribePageVars = {
    email: contact.email,
    list_name: contact.listName,
    app_name: appName,
  }

  if (contact.status === 'unsubscribed') {
    const state = justConfirmed ? content.confirmed : content.alreadyUnsubscribed
    return (
      <PublicPageLayout appName={appName}>
        <StateBlock state={state} vars={vars} />
      </PublicPageLayout>
    )
  }

  return (
    <PublicPageLayout appName={appName}>
      <StateBlock state={content.confirm} vars={vars}>
        <form action={unsubscribeAction} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-destructive px-6 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            {content.confirm.buttonLabel || 'Confirm Unsubscribe'}
          </button>
        </form>
      </StateBlock>
    </PublicPageLayout>
  )
}
