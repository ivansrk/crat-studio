import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/i18n/format-date'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'
import { SectionShader } from '@/components/site/SectionShader'

// CERT-06/D-010: публичная проверка подлинности — доступна без входа, как /login.
// force-dynamic: номер меняется от запроса к запросу, статически не кэшируем.
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ number: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { number } = await params
  return { title: `${t.cert.kicker} ${number}` }
}

export default async function CertPage({ params }: Props) {
  const { number } = await params
  const cert = await db.certificate.findUnique({ where: { number } })

  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.cert.kicker} />
            {!cert ? (
              <h1 className="crat-display">{t.cert.notFound}</h1>
            ) : cert.status === 'REVOKED' ? (
              <>
                <h1 className="crat-display">{t.cert.kicker} <span className="cert-number">{cert.number}</span></h1>
                <p className="crat-muted">{t.cert.revoked}</p>
              </>
            ) : (
              // T2/T5 дизайн-аудита (D-042): те же прожектор-лучи, что у «Квиз сдан» —
              // валидный сертификат тоже маленький триумф (site.css .shader-scope/.shader-content).
              // T5: тот же документ-стиль, что в кабинете (.cert-document) + «Действителен» (мята) + печать.
              <div className="crat-card shader-scope">
                <SectionShader variant="celebrate-rays" />
                <div className="shader-content">
                  <div className="cert-document">
                    <span className="crat-stamp" aria-hidden />
                    <p className="crat-kicker cert-document-kicker">{t.cert.issuedTo}</p>
                    {/* fullName может быть null после GDPR-удаления (D-010/CERT-07) — номер и статус остаются проверяемыми. */}
                    <h1 className="crat-display cert-document-name">{cert.fullName ?? '—'}</h1>
                    <p className="cert-document-course">{t.cert.completedCourse} «{cert.courseTitle}»</p>
                    <p className="cert-document-number">{cert.number}</p>
                  </div>
                  <p className="cert-valid-label">{t.cert.validLabel}</p>
                  <p className="crat-muted">{t.cert.issuedOn}: {formatDate(cert.issuedAt)}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
