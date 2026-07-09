import { t } from '@/lib/i18n'

export function renderEmail(opts: { body: string; buttonText?: string; buttonUrl?: string; unsubscribeUrl?: string }): string {
  const btn = opts.buttonUrl && opts.buttonText
    ? `<p style="margin:28px 0"><a href="${opts.buttonUrl}" style="background:#FF4B3A;color:#F2E9DC;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:18px">${opts.buttonText}</a></p>`
    : ''
  const unsub = opts.unsubscribeUrl
    ? `<p style="font-size:14px"><a href="${opts.unsubscribeUrl}" style="color:#B9A7D6">${t.email.unsubscribe}</a></p>`
    : ''
  return `<div style="background:#0E0B0B;color:#F2E9DC;padding:32px;font-family:Arial,sans-serif;font-size:18px;line-height:1.6">
    <p>${opts.body}</p>${btn}<p style="color:#B9A7D6;font-size:16px">${t.email.footer}</p>${unsub}</div>`
}
