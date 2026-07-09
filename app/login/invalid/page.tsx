import Link from 'next/link'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'

export default async function Invalid({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams
  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.auth.kicker} />
            <div className="crat-card accepted-card">
              <h1 className="crat-display">{reason === 'expired' ? t.auth.expiredTitle : t.auth.usedTitle}</h1>
              <p className="crat-muted">{t.auth.invalidBody}</p>
              <Link className="crat-button primary" href="/login">{t.auth.requestAgain}</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
