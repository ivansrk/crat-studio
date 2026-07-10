import type { Metadata } from 'next'
import Script from 'next/script'
import { accent, body, mono } from './fonts'
import { t } from '@/lib/i18n'
import { CookieBanner } from '@/components/CookieBanner'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: { default: t.seo.homeTitle, template: '%s — CRAT studio' },
  description: t.seo.homeDescription,
  alternates: { canonical: '/' },
  openGraph: { siteName: 'CRAT studio', locale: 'ru_RU', type: 'website' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN
  return (
    <html
      lang="ru"
      className={`${accent.variable} ${body.variable} ${mono.variable}`}
      // impeccable P1-2: beforeInteractive-скрипт ниже добавляет класс js ДО гидратации —
      // React иначе ловит это как hydration mismatch на <html> (server className без js,
      // client — с ним) и логирует ошибку в консоль/dev-оверлей. Тот же приём, что у
      // next-themes для аналогичного паттерна (класс темы на <html> до гидратации).
      suppressHydrationWarning
    >
      <body>
        {/* impeccable P1-2: reveal-гейтинг секций (T3, .crat-section view()-анимации, components/site.css)
            не должен прятать контент, если JS выключен, — «reveal must enhance already-visible default».
            beforeInteractive гарантирует выполнение до гидратации/первой отрисовки; без JS скрипт не
            выполняется вовсе, html не получает класс js, и CSS-селектор ниже просто не матчит —
            секции остаются в дефолтном видимом состоянии (opacity:1, без анимации). */}
        <Script id="js-flag" strategy="beforeInteractive">
          {`document.documentElement.classList.add('js')`}
        </Script>
        {children}
        {/* LEGAL-04/06, D-037: информационный баннер на всех страницах сайта (публичных и кабинета). */}
        <CookieBanner />
        {plausibleDomain && (
          <Script defer data-domain={plausibleDomain} src="https://plausible.io/js/script.js" strategy="afterInteractive" />
        )}
      </body>
    </html>
  )
}
