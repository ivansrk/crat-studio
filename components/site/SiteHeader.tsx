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
          {/* Название студии несёт сам логотип (решение Ивана 2026-07-10) — текстового
              дубля «CRAT studio» рядом нет, только mono-подпись направлений. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- статичный мелкий asset, next/image избыточен */}
          <img src="/brand/logo.png" alt={t.header.logoAlt} width={84} height={84} className="site-brand-logo" />
          <span className="site-brand-text">
            <span className="crat-kicker">{t.header.sub}</span>
          </span>
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
