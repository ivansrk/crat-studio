'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * impeccable minor: подсветка текущего раздела (aria-current="page") — критика
 * 2026-07-10 отметила «нет active-состояния nav». SiteHeader серверный (сам зовёт
 * currentUser()), usePathname там недоступен — вместо headers()-эвристики (хрупко,
 * зависит от заголовков прокси/рендера) выносим только эту подсветку в маленький
 * клиентский компонент, дешёвый и честный способ.
 * Якорные ссылки на секции главной (/#course и т.п.) не размечаем: aria-current
 * относится к текущей СТРАНИЦЕ, а не прокрученной секции — без scroll-spy пометка
 * всех якорей сразу была бы неверной (все указывают на путь "/"). Размечаем только
 * ссылки на отдельные страницы (/articles, /login, /app).
 */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname()
  const isAnchor = href.includes('#')
  const current = !isAnchor && pathname === href
  return (
    <Link href={href} aria-current={current ? 'page' : undefined}>
      {children}
    </Link>
  )
}
