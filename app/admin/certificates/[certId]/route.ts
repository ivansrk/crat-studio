import { notFound } from 'next/navigation'
import { currentUser, isAdminEmail } from '@/lib/auth/current-user'
import { db } from '@/lib/db'
import { renderCertificatePdf } from '@/lib/cert/pdf'
import { formatDate } from '@/lib/i18n/format-date'

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
  if (!cert || cert.status !== 'VALID' || !cert.fullName) notFound()

  const pdf = await renderCertificatePdf({
    fullName: cert.fullName, courseTitle: cert.courseTitle, number: cert.number, dateStr: formatDate(cert.issuedAt),
  })
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${cert.number}.pdf"`,
      'Cache-Control': 'no-store', // D-011: не кэшировать — рендер на каждое скачивание
    },
  })
}
