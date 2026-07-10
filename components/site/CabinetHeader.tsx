import Link from 'next/link'
import { getCourses } from '@/lib/content'
import { logoutAction } from '@/app/actions/logout'
import { t } from '@/lib/i18n'
import { CabinetCourseTitle } from './CabinetCourseTitle'

/**
 * T4 дизайн-аудита: компактная липкая шапка авторизованной зоны (/app/*). Раньше
 * app/app/layout.tsx был голым гейтом — на страницах кабинета вообще не было шапки,
 * «Аккаунт»/«Выйти» дублировались локально внизу каждой страницы. Теперь один источник:
 * лого-штамп 44px → /app, название текущего курса (если открыт курс/урок), справа
 * «Аккаунт» и «Выйти» — подключается один раз в app/app/layout.tsx.
 */
export function CabinetHeader() {
  const courseTitles = Object.fromEntries(getCourses().map(c => [c.slug, c.course.title]))
  return (
    <header className="cabinet-header">
      <div className="cabinet-header-inner crat-shell">
        <Link href="/app" className="cabinet-header-brand" aria-label={t.cabinet.headerHomeAria}>
          {/* eslint-disable-next-line @next/next/no-img-element -- статичный мелкий asset, как в SiteHeader */}
          <img src="/brand/logo.png" alt="" width={44} height={44} className="cabinet-header-logo" />
        </Link>
        <CabinetCourseTitle courses={courseTitles} />
        <nav className="cabinet-header-actions" aria-label={t.cabinet.headerActionsAria}>
          <Link className="reveal-line" href="/app/account">{t.auth.accountNavLabel}</Link>
          <form action={logoutAction}>
            <button type="submit" className="reveal-line cabinet-header-logout">{t.auth.logout}</button>
          </form>
        </nav>
      </div>
    </header>
  )
}
