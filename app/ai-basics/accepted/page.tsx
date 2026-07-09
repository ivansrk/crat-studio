import Link from 'next/link'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'

export default function Accepted() {
  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.landing.courseLabel} />
            <div className="crat-card accepted-card">
              <h1 className="crat-display">{t.landing.acceptedTitle}</h1>
              <p className="crat-muted">{t.landing.acceptedBody}</p>
              <Link className="crat-button primary" href="/">{t.landing.backHome}</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
