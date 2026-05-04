import Handlebars from 'handlebars'
import juice from 'juice'
import { convert as htmlToText } from 'html-to-text'
import type { Block } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

export function renderBlocks(blocks: Block[]): string {
  logger.info({ blockCount: blocks.length, blockTypes: blocks.map(b => b?.type) }, 'renderBlocks: rendering blocks to HTML')
  const result = blocks.map((block, i) => {
    const html = renderBlock(block)
    logger.info({ index: i, type: block?.type, propsText: (block?.props as Record<string, string>)?.text?.substring(0, 100), outputLength: html.length }, 'renderBlocks: rendered individual block')
    return html
  }).join('\n')
  logger.info({ totalOutputLength: result.length, outputPreview: result.substring(0, 300) }, 'renderBlocks: final blocks HTML')
  return result
}

function renderBlock(block: Block): string {
  const p = block.props as Record<string, string>
  switch (block.type) {
    case 'heading':
      return `<h2 style="font-family:sans-serif;font-size:${p.fontSize || '24px'};color:${p.color || '#111827'};margin:0 0 16px 0;">${p.text || ''}</h2>`
    case 'text':
      return `<p style="font-family:sans-serif;font-size:${p.fontSize || '16px'};color:${p.color || '#374151'};margin:0 0 16px 0;line-height:1.6;">${p.text || ''}</p>`
    case 'button':
      return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="${p.align || 'center'}" style="padding:8px 0;"><a href="${p.url || '#'}" style="display:inline-block;background:${p.bgColor || '#2563eb'};color:${p.textColor || '#ffffff'};font-family:sans-serif;font-size:16px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:6px;">${p.text || 'Click here'}</a></td></tr></table>`
    case 'image':
      return `<img src="${p.src || ''}" alt="${p.alt || ''}" width="${p.width || '100%'}" style="display:block;max-width:100%;border:0;" />`
    case 'divider':
      return `<hr style="border:none;border-top:1px solid ${p.color || '#e5e7eb'};margin:24px 0;" />`
    case 'spacer':
      return `<div style="height:${p.height || '24px'};"></div>`
    default:
      return ''
  }
}

export function renderTemplate(options: {
  blocks: Block[]
  contact: Record<string, string>
  sendId: string
  appUrl: string
  unsubscribeUrl: string
  rawHtml?: string | null
  disableTracking?: boolean
  footerHtml?: string | null
}): string {
  const { blocks, contact, sendId, appUrl, unsubscribeUrl, rawHtml, disableTracking, footerHtml } = options

  // Defensive: ensure blocks is an array
  const safeBlocks = Array.isArray(blocks) ? blocks : []

  logger.info({
    sendId,
    blocksIsArray: Array.isArray(blocks),
    blocksLength: safeBlocks.length,
    blocksTypes: safeBlocks.map(b => b?.type),
    rawHtmlType: typeof rawHtml,
    rawHtmlLength: typeof rawHtml === 'string' ? rawHtml.length : 0,
    rawHtmlTruthy: !!rawHtml,
  }, 'renderTemplate: input diagnostics')

  // Prefer visual blocks if they exist, fall back to raw HTML from code editor
  let bodyHtml: string
  let renderPath: string

  if (safeBlocks.length > 0) {
    renderPath = 'blocks'
    bodyHtml = renderBlocks(safeBlocks)
    logger.info({ sendId, renderPath, bodyHtmlLength: bodyHtml.length, bodyHtmlPreview: bodyHtml.substring(0, 300) }, 'renderTemplate: rendered blocks to HTML')
  } else if (rawHtml && typeof rawHtml === 'string' && rawHtml.trim().length > 0) {
    renderPath = 'rawHtml'
    bodyHtml = rawHtml
    logger.info({ sendId, renderPath, bodyHtmlLength: bodyHtml.length, bodyHtmlPreview: bodyHtml.substring(0, 300) }, 'renderTemplate: using raw HTML')
  } else {
    renderPath = 'empty'
    bodyHtml = ''
    logger.warn({ sendId, renderPath, blocksLength: safeBlocks.length, rawHtmlLength: typeof rawHtml === 'string' ? rawHtml.length : 0 }, 'renderTemplate: WARNING no content found, body will be empty')
  }

  // Replace Handlebars merge tags (e.g. {{first_name}}, {{unsubscribe_url}})
  const template = Handlebars.compile(bodyHtml)
  const merged = template(contact)
  logger.info({ sendId, mergedLength: merged.length, mergedPreview: merged.substring(0, 300) }, 'renderTemplate: after Handlebars merge')

  const withTracking = disableTracking ? merged : wrapLinks(merged, sendId, appUrl)

  const trackingPixel = disableTracking
    ? ''
    : `<img src="${appUrl}/t/${sendId}" width="1" height="1" border="0" style="display:block;" />`

  const defaultUnsubscribeFooter = `
    <div style="text-align:center;padding:24px 0;font-family:sans-serif;font-size:12px;color:#9ca3af;">
      <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
    </div>
  `
  const resolvedFooter =
    footerHtml === null ? '' : footerHtml !== undefined ? footerHtml : defaultUnsubscribeFooter

  // Check if rawHtml is a complete HTML document (has its own <html>/<body> tags)
  const isFullDocument = renderPath === 'rawHtml' && /<html[\s>]/i.test(withTracking)

  let full: string
  if (isFullDocument) {
    // Full HTML document: Handlebars already replaced {{unsubscribe_url}}, {{first_name}}, etc.
    // Just add tracking pixel before </body>, no extra wrapper or footer
    logger.info({ sendId }, 'renderTemplate: rawHtml is a full HTML document, sending as-is with tracking pixel')
    const bodyCloseIndex = withTracking.toLowerCase().lastIndexOf('</body>')
    if (bodyCloseIndex !== -1 && trackingPixel) {
      full = withTracking.substring(0, bodyCloseIndex) + trackingPixel + withTracking.substring(bodyCloseIndex)
    } else {
      full = withTracking + trackingPixel
    }
  } else {
    // Wrap block-based or fragment HTML in the email template
    full = `
    <html><body style="margin:0;padding:0;background:#f9fafb;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;max-width:600px;">
            <tr><td>${withTracking}</td></tr>
            ${resolvedFooter ? `<tr><td>${resolvedFooter}</td></tr>` : ''}
            ${trackingPixel ? `<tr><td>${trackingPixel}</td></tr>` : ''}
          </table>
        </td></tr>
      </table>
    </body></html>
  `
  }

  logger.info({ sendId, isFullDocument, finalHtmlLength: full.length }, 'renderTemplate: final HTML generated')
  // Always inline styles. Email clients (notably Gmail) strip or limit <style> blocks,
  // so <style> rules must be inlined onto element style attributes to render reliably.
  // Keep media queries and font-face rules in <style> tags since juice cannot inline them.
  return juice(full, {
    preserveMediaQueries: true,
    preserveFontFaces: true,
    removeStyleTags: false,
  })
}

export function renderPlainText(html: string): string {
  return htmlToText(html, {
    wordwrap: 78,
    selectors: [
      { selector: 'img', format: 'skip' },
      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } },
    ],
  })
}

function wrapLinks(html: string, sendId: string, appUrl: string): string {
  // Escape special regex characters in the appUrl
  const escapedAppUrl = appUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `href="((?!${escapedAppUrl}/r/|${escapedAppUrl}/unsubscribe/|#)[^"]+)"`,
    'g'
  )
  return html.replace(pattern, (_, url) => {
    const encoded = Buffer.from(JSON.stringify({ sendId, url })).toString('base64url')
    return `href="${appUrl}/r/${encoded}"`
  })
}
