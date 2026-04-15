import Handlebars from 'handlebars'
import juice from 'juice'
import type { Block } from '@/lib/db/schema'

export function renderBlocks(blocks: Block[]): string {
  return blocks.map(renderBlock).join('\n')
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
}): string {
  const { blocks, contact, sendId, appUrl, unsubscribeUrl } = options

  const bodyHtml = renderBlocks(blocks)

  const template = Handlebars.compile(bodyHtml)
  const merged = template(contact)

  const withTracking = wrapLinks(merged, sendId, appUrl)

  const trackingPixel = `<img src="${appUrl}/t/${sendId}" width="1" height="1" border="0" style="display:block;" />`

  const unsubscribeFooter = `
    <div style="text-align:center;padding:24px 0;font-family:sans-serif;font-size:12px;color:#9ca3af;">
      <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
    </div>
  `

  const full = `
    <html><body style="margin:0;padding:0;background:#f9fafb;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;max-width:600px;">
            <tr><td>${withTracking}</td></tr>
            <tr><td>${unsubscribeFooter}</td></tr>
            <tr><td>${trackingPixel}</td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>
  `

  return juice(full)
}

function wrapLinks(html: string, sendId: string, appUrl: string): string {
  return html.replace(
    /href="((?!APP_URL\/r\/|APP_URL\/unsubscribe\/)[^"]+)"/g,
    (_, url) => {
      const encoded = Buffer.from(JSON.stringify({ sendId, url })).toString('base64url')
      return `href="${appUrl}/r/${encoded}"`
    }
  )
}
