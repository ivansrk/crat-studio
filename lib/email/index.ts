import { Resend } from 'resend'
import { db } from '@/lib/db'
import type { EmailType, Prisma } from '@/lib/generated/prisma/client'

export const RETRY_DELAYS_MS = [60_000, 300_000, 900_000] // 1/5/15 мин (D-013)
export const FROM = 'CRAT studio <hello@cratstudio.com>'

type SendFn = () => Promise<{ id?: string }>
type Progress = { status: 'SENT' | 'FAILED'; attempts: number; resendId?: string; lastError?: string }

/** Ошибка onFinal не должна ни превращать успех в ретрай (дубль письма), ни ронять промис (void-вызов). */
function safeFinal(onFinal: (p: Progress) => void, p: Progress): void {
  try { onFinal(p) } catch (err) { console.error('[email] onFinal упал:', err) }
}

/** Ядро ретраев — чистое, транспорт инжектируется (тестируемо без Resend). */
export async function deliverWithRetries(send: SendFn, onFinal: (p: Progress) => void): Promise<void> {
  let attempts = 0
  let lastError = ''
  for (;;) {
    attempts++
    let r: { id?: string }
    try {
      r = await send()
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
      const delay = RETRY_DELAYS_MS[attempts - 1]
      if (delay === undefined) { safeFinal(onFinal, { status: 'FAILED', attempts, lastError }); return }
      await new Promise(res => setTimeout(res, delay))
      continue
    }
    // успех уведомляется вне try доставки: throw из onFinal не попадёт в retry-catch
    safeFinal(onFinal, { status: 'SENT', attempts, resendId: r.id })
    return
  }
}

/** Отправка с логом (MAIL-03): создаёт EmailLog QUEUED, шлёт c ретраями в фоне процесса.
 *  Потерянные при рестарте ретраи остаются QUEUED/FAILED и видны в админке (D-013). */
export async function sendEmail(opts: {
  to: string; userId?: string | null; type: EmailType; subject: string; html: string
  payload: Prisma.InputJsonValue // данные для ручной переотправки (ADM-08)
}): Promise<string> {
  const log = await db.emailLog.create({
    data: { toEmail: opts.to, userId: opts.userId ?? null, type: opts.type, subject: opts.subject, payload: opts.payload },
  })
  const resend = new Resend(process.env.RESEND_API_KEY)
  const send: SendFn = async () => {
    const { data, error } = await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html })
    if (error) throw new Error(error.message)
    return { id: data?.id }
  }
  // fire-and-forget: HTTP-ответ пользователю не ждёт ретраев
  void deliverWithRetries(send, async p => {
    await db.emailLog.update({
      where: { id: log.id },
      data: { status: p.status, attempts: p.attempts, resendId: p.resendId ?? null, lastError: p.lastError ?? null, sentAt: p.status === 'SENT' ? new Date() : null },
    }).catch(err => console.error('[email] не смог обновить лог:', err))
  })
  return log.id
}
