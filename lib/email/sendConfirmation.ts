import { db } from '@/lib/db'
import { contacts, lists, emailProviders } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createProviderAdapter } from '@/lib/providers/factory'
import { renderPlainText } from '@/lib/renderer'
import { logger } from '@/lib/logger'
import { getConfirmationSender } from '@/lib/settings'

export async function sendConfirmation(contactId: string): Promise<void> {
  const { fromEmail, fromName } = await getConfirmationSender()

  const appUrl = process.env.APP_URL
  if (!appUrl) {
    throw new Error('APP_URL is not set')
  }

  const appName = process.env.APP_NAME || 'hedwig-mail'

  const row = await db
    .select({
      id: contacts.id,
      email: contacts.email,
      firstName: contacts.firstName,
      status: contacts.status,
      confirmationToken: contacts.confirmationToken,
      listName: lists.name,
      requireDoubleOptIn: lists.requireDoubleOptIn,
    })
    .from(contacts)
    .innerJoin(lists, eq(contacts.listId, lists.id))
    .where(eq(contacts.id, contactId))
    .limit(1)

  const contact = row[0]
  if (!contact) {
    logger.warn({ contactId }, 'Confirmation: contact not found, skipping')
    return
  }

  if (contact.status !== 'pending' || !contact.confirmationToken) {
    logger.info({ contactId, status: contact.status }, 'Confirmation: contact no longer pending, skipping')
    return
  }

  const [provider] = await db
    .select()
    .from(emailProviders)
    .where(eq(emailProviders.isDefault, true))
    .limit(1)

  if (!provider) {
    throw new Error('No default email provider configured')
  }

  const adapter = createProviderAdapter(provider.type, provider.configEncrypted)
  const confirmUrl = `${appUrl}/confirm/${contact.confirmationToken}`
  const greetName = contact.firstName?.trim() || 'there'
  const safeListName = escapeHtml(contact.listName)

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;max-width:600px;">
        <tr><td>
          <h2 style="font-size:22px;color:#111827;margin:0 0 16px 0;">Confirm your subscription</h2>
          <p style="font-size:16px;color:#374151;line-height:1.6;margin:0 0 16px 0;">Hi ${escapeHtml(greetName)},</p>
          <p style="font-size:16px;color:#374151;line-height:1.6;margin:0 0 24px 0;">Please confirm that you want to receive emails from <strong>${safeListName}</strong>. Click the button below to complete your subscription.</p>
          <table cellpadding="0" cellspacing="0"><tr><td style="padding:8px 0;">
            <a href="${confirmUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:6px;">Confirm subscription</a>
          </td></tr></table>
          <p style="font-size:13px;color:#6b7280;line-height:1.6;margin:24px 0 0 0;">If the button does not work, paste this link into your browser:<br/><span style="word-break:break-all;">${confirmUrl}</span></p>
          <p style="font-size:13px;color:#9ca3af;line-height:1.6;margin:24px 0 0 0;">If you did not request this, you can ignore this message and you will not be subscribed.</p>
        </td></tr>
      </table>
      <div style="text-align:center;padding:16px 0;font-size:12px;color:#9ca3af;">${escapeHtml(appName)}</div>
    </td></tr>
  </table>
</body></html>`

  const subject = `Confirm your subscription to ${contact.listName}`

  const { messageId } = await adapter.send({
    to: contact.email,
    from: fromEmail,
    fromName,
    subject,
    html,
    text: renderPlainText(html),
  })

  logger.info({ contactId, messageId, providerType: provider.type }, 'Confirmation email sent')
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

