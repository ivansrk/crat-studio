'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { t } from '@/lib/i18n'

/**
 * T4 дизайн-аудита: название текущего курса в шапке кабинета. CabinetHeader — серверный
 * компонент (сам не знает courseSlug: app/app/layout.tsx выше сегмента [courseSlug],
 * params туда не долетают), поэтому pathname-детекция вынесена в этот маленький клиентский
 * кусок — тот же паттерн, что NavLink у SiteHeader. courses — статичная карта slug→title
 * (getCourses(), собрана на сервере), здесь никаких fs/db-вызовов.
 *
 * S2 (аудит навигации 2026-07-16, NAV-07): название курса — тихая ссылка на /app/{slug}
 * (быстрый путь «на страницу курса» из урока/подстраниц). Ссылка есть только когда курс
 * известен (title найден по slug) — на /app/account и т.п. компонент возвращает null,
 * ссылки нет. Стиль остаётся тихим (не neon-ссылка): цвет kicker + hover-подчёркивание
 * под @media(hover:hover), :focus-visible виден (cabinet.css). Высота шапки не меняется —
 * inline-элемент того же размера, что был <span>.
 */
export function CabinetCourseTitle({ courses }: { courses: Record<string, string> }) {
  const pathname = usePathname()
  const slug = pathname.split('/')[2] // '/app/{slug}/...' — 'account'/'trainers'/'review' в courses не попадут
  const title = slug ? courses[slug] : undefined
  if (!title || !slug) return null
  return (
    <Link
      href={`/app/${slug}`}
      className="cabinet-header-course crat-kicker"
      aria-label={t.cabinet.headerCourseAria.replace('{title}', title)}
    >
      {title}
    </Link>
  )
}
