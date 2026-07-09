import { db } from '@/lib/db'
import type { ConsentSource, ConsentType } from '@/lib/generated/prisma/client'

/** Append-only (D-014): отписка/повтор = новая строка, история не переписывается. */
export async function appendConsent(opts: {
  email: string; type: ConsentType; granted: boolean; source: ConsentSource; userId?: string | null
}) {
  await db.consent.create({ data: { ...opts, email: opts.email.trim().toLowerCase() } })
}

/** Чистая свёртка «действующее согласие = последняя запись» — используется CSV-экспортом (ADM-09). */
export function latestConsentByEmail(rows: { email: string; granted: boolean; createdAt: Date }[]): Map<string, boolean> {
  const m = new Map<string, boolean>()
  for (const r of [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) m.set(r.email, r.granted)
  return m
}
