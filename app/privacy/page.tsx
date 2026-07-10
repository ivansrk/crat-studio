import type { Metadata } from 'next'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'

export const metadata: Metadata = {
  title: t.seo.privacyTitle,
  description: t.seo.privacyDescription,
  alternates: { canonical: '/privacy' },
}

/**
 * Ф7в T5, LEGAL-01/02/06: политика конфиденциальности. Структура-каркас с осмысленными
 * разделами; финальные юридические формулировки пришлёт Иван — до этого каждый раздел
 * прямо помечен t.legal.todoNotice (E-LEG1: страница существует и не выглядит битой).
 * TODO: тексты от Ивана.
 */
export default function PrivacyPage() {
  const tl = t.legal.privacy

  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.legal.kicker} />
            <h1 className="crat-display">{tl.title}</h1>
            <p className="crat-muted section-intro">{tl.lead}</p>
            <p className="legal-notice">{t.legal.todoNotice}</p>
            <div className="legal-sections">
              {tl.sections.map(s => (
                <article key={s.heading}>
                  <h2>{s.heading}</h2>
                  <p className="crat-muted">{s.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
