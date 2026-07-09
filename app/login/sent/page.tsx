import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'

export default function Sent() {
  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.auth.kicker} />
            <div className="crat-card accepted-card">
              <h1 className="crat-display">{t.auth.sentTitle}</h1>
              <p className="crat-muted">{t.auth.sentBody}</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
