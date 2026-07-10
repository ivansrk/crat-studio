import { db } from '@/lib/db'
import type { ConsentType, PrismaClient } from '@/lib/generated/prisma/client'

// D-014: журнал consents — append-only, действующее согласие = последняя запись по (email, type).
// Раньше правило было размазано по вызывающему коду (newsletter-csv.ts свою свёртку держал сам);
// Ф7б Task 7 выносит единственную реализацию сюда — переиспользуют CRM (lib/crm), CSV-экспорт
// рассылки (ADM-09) и гэп ручной выдачи доступа (lib/admin/grant-access.ts, CRM-гэп).

/** Чистая свёртка по множеству email: для каждого email — granted последней по createdAt записи.
 *  Годится, когда строки уже выбраны на один тип (или тип не важен) и охватывают много email сразу
 *  (используется CSV-экспортом, который тянет весь журнал NEWSLETTER одним запросом). */
export function latestConsentByEmail(rows: { email: string; granted: boolean; createdAt: Date }[]): Map<string, boolean> {
  const m = new Map<string, boolean>()
  for (const r of [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) m.set(r.email, r.granted)
  return m
}

/** То же правило для одного email/типа, когда строки уже на руках (например, вся история
 *  клиента загружена для карточки CRM одним запросом) — без похода в базу. */
export function isEffectivelyGranted(rows: { granted: boolean; createdAt: Date }[]): boolean {
  if (rows.length === 0) return false
  return [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).at(-1)!.granted
}

type ConsentDbClient = Pick<PrismaClient, 'consent'>

/** Действующее согласие конкретного email/типа одним запросом (latest by createdAt) —
 *  для точечных проверок (resync клиента, гэп grant-access), где тянуть весь журнал незачем. */
export async function getEffectiveConsent(email: string, type: ConsentType, client: ConsentDbClient = db): Promise<boolean> {
  const latest = await client.consent.findFirst({
    where: { email: email.trim().toLowerCase(), type },
    orderBy: { createdAt: 'desc' },
  })
  return latest?.granted ?? false
}
