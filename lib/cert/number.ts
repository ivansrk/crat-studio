import type { Prisma } from '@/lib/generated/prisma/client'

export const formatCertNumber = (year: number, n: number): string =>
  `CRAT-${year}-${String(n).padStart(4, '0')}`

/** Год по Europe/Warsaw (CERT-03, UX-08). */
export const certYearWarsaw = (d: Date = new Date()): number =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', year: 'numeric' }).format(d))

/** Следующий номер — транзакционно, без гонок и дублей (CERT-03, data-model «без гонок»).
 *  Вызывать ТОЛЬКО внутри interactive transaction (tx). SELECT ... FOR UPDATE через $queryRaw. */
export async function nextCertNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
  const year = certYearWarsaw(now)
  await tx.$executeRaw`INSERT INTO "CertificateCounter" ("year","counter") VALUES (${year},0) ON CONFLICT ("year") DO NOTHING`
  const rows = await tx.$queryRaw<{ counter: number }[]>`SELECT "counter" FROM "CertificateCounter" WHERE "year"=${year} FOR UPDATE`
  const next = rows[0].counter + 1
  await tx.certificateCounter.update({ where: { year }, data: { counter: next } })
  return formatCertNumber(year, next)
}
