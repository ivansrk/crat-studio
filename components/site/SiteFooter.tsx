import Link from 'next/link'
import { t } from '@/lib/i18n'

/** Тихий футер публичных страниц (SITE-07, бриф §7.12): бренд, направления, nav, mailto. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner crat-shell">
        <div className="site-footer-brand">
          <span className="site-brand-name">{t.home.brand}</span>
          <p className="crat-muted">{t.footer.tagline}</p>
          <p className="crat-muted">{t.footer.directions}</p>
        </div>
        <nav className="crat-nav site-nav" aria-label={t.footer.navAria}>
          <Link href="/#course">{t.footer.navCourses}</Link>
          <Link href="/#automation">{t.footer.navAutomation}</Link>
          <Link href="/#studio">{t.footer.navStudio}</Link>
          <Link href="/#team">{t.footer.navTeam}</Link>
        </nav>
        <a className="crat-muted site-footer-email" href={`mailto:${t.footer.contactEmail}`}>{t.footer.contactEmail}</a>
      </div>
    </footer>
  )
}
