import { t } from '@/lib/i18n'

/** Подстановка {{key}} в шаблон письма. Нужна для WELCOME (T5, AUTH-15): пароль — секрет,
 *  который живёт только в html-теле письма, поэтому рендерится отдельно от body-строки
 *  из ru.ts, а не хранится где-либо готовым текстом. */
export function fillPlaceholders(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((acc, [key, val]) => acc.split(`{{${key}}}`).join(val), template)
}

/** CONS-03: письмо админам о новой заявке на консультацию — та же плейсхолдер-подстановка,
 *  что и у WELCOME (fillPlaceholders): данные заявки живут в HTML-теле, а не готовым текстом
 *  в ru.ts. Направление (topic) опционально — прочерк, если не выбрано. */
export function renderConsultationEmail(input: { name: string; contact: string; topic: string | null; message: string }): string {
  const body = fillPlaceholders(t.email.consultationBody, {
    name: input.name, contact: input.contact, topic: input.topic ?? '—', message: input.message,
  })
  return renderEmail({ body })
}

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
