import { notFound } from 'next/navigation'
import { currentUser, isAdminEmail } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { getCourse } from '@/lib/content'
import { renderCertificatePdf } from '@/lib/cert/pdf'
import { resolveCertPeriodStr } from '@/lib/cert'
import { buildProgramHtml } from '@/lib/cert/program'

export const dynamic = 'force-dynamic'

/** ADM-12/D-043: скачивание сертификата ЛЮБОГО клиента из карточки /admin/clients/[userId].
 *  Гейт — тот же приём, что /admin/cert-preview (route.ts вне admin/layout, свой ADM-01-гейт).
 *  D-011 не меняется: PDF не хранится, рендерится на лету при каждом скачивании. Только VALID —
 *  REVOKED-сертификат недействителен и не отдаётся даже админу (D-043). */
export async function GET(_request: Request, { params }: { params: Promise<{ certId: string }> }) {
  const user = await currentUser()
  if (!user || !isAdminEmail(user.email)) notFound() // ADM-01

  const { certId } = await params
  const cert = await db.certificate.findUnique({ where: { id: certId } })
  // D-010: userId обнуляется ТОЛЬКО вместе с переходом в REVOKED — у VALID он всегда есть;
  // явная проверка вместо `!` для типобезопасности (cert.userId: string | null в схеме).
  if (!cert || cert.status !== 'VALID' || !cert.fullName || !cert.userId) notFound()

  const pdf = await renderCertificatePdf({
    fullName: cert.fullName,
    courseTitle: cert.courseTitle,
    number: cert.number,
    hours: getCourse(cert.courseSlug)?.hours ?? 72, // CERT-09
    periodStr: await resolveCertPeriodStr(cert.userId, cert.courseSlug, cert.issuedAt), // CERT-08
    programHtml: buildProgramHtml(cert.courseSlug),
  })
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${cert.number}.pdf"`,
      'Cache-Control': 'no-store', // D-011: не кэшировать — рендер на каждое скачивание
    },
  })
}
