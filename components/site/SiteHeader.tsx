import Link from 'next/link'
import { currentUser } from '@/lib/auth/current-user'
import { t } from '@/lib/i18n'

/**
 * Липкая тихая шапка публичных страниц (SITE-07, бриф §7.1).
 * Серверный компонент: сам зовёт currentUser() (cache() внутри — один findUnique
 * на рендер), чтобы решить «Войти» vs «В кабинет». На /login без сессии — null,
 * это ожидаемо (см. Task 3 «Правила»).
 */
export async function SiteHeader() {
  const user = await currentUser()
  return (
    <header className="site-header">
      <div className="site-header-inner crat-shell">
        <Link href="/" className="site-brand">
          <span className="site-brand-name">{t.home.brand}</span>
          <span className="crat-kicker">{t.header.sub}</span>
        </Link>
        <nav className="crat-nav site-nav" aria-label={t.header.navAria}>
          <Link href="/#course">{t.footer.navCourses}</Link>
          <Link href="/#automation">{t.footer.navAutomation}</Link>
          <Link href="/#studio">{t.footer.navStudio}</Link>
          <Link href="/#team">{t.footer.navTeam}</Link>
          <Link href="/articles">{t.footer.navArticles}</Link>
          {user
            ? <Link href="/app">{t.home.toCabinet}</Link>
            : <Link href="/login">{t.footer.login}</Link>}
        </nav>
      </div>
    </header>
  )
}
