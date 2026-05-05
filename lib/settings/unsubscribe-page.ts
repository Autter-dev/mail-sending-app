import Handlebars from 'handlebars'
import sanitizeHtml from 'sanitize-html'
import type { UnsubscribePageContent, UnsubscribePageStateContent } from '@/lib/db/schema'

export const UNSUBSCRIBE_PAGE_DEFAULTS: UnsubscribePageContent = {
  confirm: {
    title: 'Unsubscribe',
    body: 'Are you sure you want to unsubscribe <strong>{{email}}</strong> from <strong>{{list_name}}</strong>?',
    buttonLabel: 'Confirm Unsubscribe',
  },
  confirmed: {
    title: 'Unsubscribed',
    body: 'You have been unsubscribed from <strong>{{list_name}}</strong>. You will no longer receive emails to <strong>{{email}}</strong>.',
  },
  alreadyUnsubscribed: {
    title: 'Already Unsubscribed',
    body: '<strong>{{email}}</strong> is already unsubscribed from <strong>{{list_name}}</strong>.',
  },
  invalid: {
    title: 'Invalid Link',
    body: 'This link is invalid or has already been used.',
  },
}

const ALLOWED_TAGS = ['a', 'strong', 'em', 'b', 'i', 'br', 'p', 'span']
const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ['href', 'target', 'rel'],
  span: [],
}

export const UNSUBSCRIBE_BODY_ALLOWED_TAGS = ALLOWED_TAGS

export interface UnsubscribePageVars {
  email: string
  list_name: string
  app_name: string
}

function mergeState(
  override: Partial<UnsubscribePageStateContent> | undefined,
  fallback: UnsubscribePageStateContent,
): UnsubscribePageStateContent {
  if (!override) return fallback
  return {
    title: override.title?.trim() ? override.title : fallback.title,
    body: override.body?.trim() ? override.body : fallback.body,
    buttonLabel: override.buttonLabel?.trim() ? override.buttonLabel : fallback.buttonLabel,
  }
}

export function mergeUnsubscribePageContent(
  override: Partial<UnsubscribePageContent> | null | undefined,
): UnsubscribePageContent {
  return {
    confirm: mergeState(override?.confirm, UNSUBSCRIBE_PAGE_DEFAULTS.confirm),
    confirmed: mergeState(override?.confirmed, UNSUBSCRIBE_PAGE_DEFAULTS.confirmed),
    alreadyUnsubscribed: mergeState(
      override?.alreadyUnsubscribed,
      UNSUBSCRIBE_PAGE_DEFAULTS.alreadyUnsubscribed,
    ),
    invalid: mergeState(override?.invalid, UNSUBSCRIBE_PAGE_DEFAULTS.invalid),
  }
}

export function renderUnsubscribeBody(template: string, vars: UnsubscribePageVars): string {
  const compiled = Handlebars.compile(template, { noEscape: false })
  const merged = compiled(vars)
  return sanitizeHtml(merged, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: attribs.target || '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    },
  })
}

export function renderUnsubscribeTitle(template: string, vars: UnsubscribePageVars): string {
  const compiled = Handlebars.compile(template, { noEscape: true })
  return compiled(vars)
}
