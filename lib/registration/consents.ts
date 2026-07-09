import { db } from '@/lib/db'
import type { ConsentSource, ConsentType, PrismaClient } from '@/lib/generated/prisma/client'

/** Append-only (D-014): отписка/повтор = новая строка, история не переписывается.
 *  client позволяет писать в рамках db.$transaction (передать tx). */
export async function appendConsent(opts: {
  email: string; type: ConsentType; granted: boolean; source: ConsentSource; userId?: string | null
}, client: Pick<PrismaClient, 'consent'> = db) {
  await client.consent.create({ data: { ...opts, email: opts.email.trim().toLowerCase() } })
}

/** Отписка по ссылке из письма (MAIL-06). Ревью T12: после GDPR-удаления токен отписки
 *  остаётся криптографически валиден (HMAC без TTL) — не воскрешаем email в базе: запись
 *  пишется только если субъект ещё существует (User или Registration), иначе молча выходим.
 *  UI показывает одинаковый ответ в обоих случаях (не создаём oracle существования). */
export async function recordUnsubscribe(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase()
  const user = await db.user.findUnique({ where: { email: normalized } })
  const registration = user ? null : await db.registration.findUnique({ where: { email: normalized } })
  if (!user && !registration) return
  await appendConsent({ email: normalized, type: 'NEWSLETTER', granted: false, source: 'UNSUBSCRIBE_LINK', userId: user?.id })
}

/** Чистая свёртка «действующее согласие = последняя запись» — используется CSV-экспортом (ADM-09). */
export function latestConsentByEmail(rows: { email: string; granted: boolean; createdAt: Date }[]): Map<string, boolean> {
  const m = new Map<string, boolean>()
  for (const r of [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) m.set(r.email, r.granted)
  return m
}
