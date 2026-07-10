'use client'
import { usePathname } from 'next/navigation'

/**
 * T4 дизайн-аудита: название текущего курса в шапке кабинета. CabinetHeader — серверный
 * компонент (сам не знает courseSlug: app/app/layout.tsx выше сегмента [courseSlug],
 * params туда не долетают), поэтому pathname-детекция вынесена в этот маленький клиентский
 * кусок — тот же паттерн, что NavLink у SiteHeader. courses — статичная карта slug→title
 * (getCourses(), собрана на сервере), здесь никаких fs/db-вызовов.
 */
export function CabinetCourseTitle({ courses }: { courses: Record<string, string> }) {
  const pathname = usePathname()
  const slug = pathname.split('/')[2] // '/app/{slug}/...' — 'account'/'trainers'/'review' в courses не попадут
  const title = slug ? courses[slug] : undefined
  if (!title) return null
  return <span className="cabinet-header-course crat-kicker">{title}</span>
}
