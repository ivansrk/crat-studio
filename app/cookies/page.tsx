import type { Metadata } from 'next'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'

export const metadata: Metadata = {
  title: t.seo.cookiesTitle,
  description: t.seo.cookiesDescription,
  alternates: { canonical: '/cookies' },
}

/**
 * Ф7в T5, LEGAL-01/02/04/06: политика cookies. В отличие от /privacy и /terms, разделы
 * про сам факт использования cookie/аналитики/localStorage уже фактически верны (D-037) —
 * todoNotice здесь про окончательную юридическую формулировку страницы в целом, а не про
 * то, что технические факты неизвестны. TODO: финальный текст от Ивана.
 */
export default function CookiesPage() {
  const tl = t.legal.cookies

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
