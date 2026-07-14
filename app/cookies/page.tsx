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
 * Ф7в T5, LEGAL-01/02/04/06 + D-045: политика cookies. Юридический скелет перенесён со
 * skld.me 2026-07-14 и совмещён с уже честным списком фактических технологий cratstudio
 * (D-037) — подробности адаптации см. lib/i18n/ru.ts legal.cookies. Каждая секция —
 * последовательность блоков { p } | { ul } (см. комментарий у legal в ru.ts).
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
            <div className="legal-sections">
              {tl.sections.map(s => (
                <article key={s.heading}>
                  <h2>{s.heading}</h2>
                  {s.blocks.map((b, i) => 'p' in b
                    ? <p className="crat-muted" key={i}>{b.p}</p>
                    : <ul className="crat-muted" key={i}>{b.ul.map((item, j) => <li key={j}>{item}</li>)}</ul>
                  )}
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
