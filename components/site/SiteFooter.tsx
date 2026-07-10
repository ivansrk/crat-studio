import Link from 'next/link'
import { t } from '@/lib/i18n'

/** Тихий футер публичных страниц (SITE-07, бриф §7.12): бренд, направления, nav, mailto. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      {/* T7 дизайн-аудита (Б.8): «свет гаснет в конце сеанса» — красный горизонт вместо
          прежней border-top: line-soft. */}
      <span className="footer-horizon" aria-hidden="true" />
      <div className="site-footer-inner crat-shell">
        <div className="site-footer-brand">
          <span className="site-brand-name">{t.home.brand}</span>
          <p className="crat-muted">{t.footer.tagline}</p>
          <p className="crat-muted">{t.footer.directions}</p>
          <span className="crat-stamp crat-stamp-muted site-footer-stamp" aria-hidden />
        </div>
        <nav className="crat-nav site-nav" aria-label={t.footer.navAria}>
          <Link href="/#course">{t.footer.navCourses}</Link>
          <Link href="/#automation">{t.footer.navAutomation}</Link>
          <Link href="/#studio">{t.footer.navStudio}</Link>
          <Link href="/#team">{t.footer.navTeam}</Link>
          <Link href="/articles">{t.footer.navArticles}</Link>
        </nav>
        <div className="site-footer-legal-col">
          <a className="crat-muted site-footer-email" href={`mailto:${t.footer.contactEmail}`}>{t.footer.contactEmail}</a>
          {/* LEGAL-03: ссылки на юр-страницы — этот футер общий для всех публичных страниц. */}
          <nav className="crat-nav site-nav site-footer-legal" aria-label={t.footer.legalNavAria}>
            <Link href="/privacy">{t.footer.navPrivacy}</Link>
            <Link href="/terms">{t.footer.navTerms}</Link>
            <Link href="/cookies">{t.footer.navCookies}</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
