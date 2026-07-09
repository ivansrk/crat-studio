import { db } from '@/lib/db'
import type { ConsentSource, ConsentType, PrismaClient } from '@/lib/generated/prisma/client'

/** Append-only (D-014): отписка/повтор = новая строка, история не переписывается.
 *  client позволяет писать в рамках db.$transaction (передать tx). */
export async function appendConsent(opts: {
  email: string; type: ConsentType; granted: boolean; source: ConsentSource; userId?: string | null
}, client: Pick<PrismaClient, 'consent'> = db) {
  await client.consent.create({ data: { ...opts, email: opts.email.trim().toLowerCase() } })
}

/** Чистая свёртка «действующее согласие = последняя запись» — используется CSV-экспортом (ADM-09). */
export function latestConsentByEmail(rows: { email: string; granted: boolean; createdAt: Date }[]): Map<string, boolean> {
  const m = new Map<string, boolean>()
  for (const r of [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) m.set(r.email, r.granted)
  return m
}
