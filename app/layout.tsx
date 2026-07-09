import type { Metadata } from 'next'
import Script from 'next/script'
import { accent, body, mono } from './fonts'
import { t } from '@/lib/i18n'
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
    <html lang="ru" className={`${accent.variable} ${body.variable} ${mono.variable}`}>
      <body>
        {children}
        {plausibleDomain && (
          <Script defer data-domain={plausibleDomain} src="https://plausible.io/js/script.js" strategy="afterInteractive" />
        )}
      </body>
    </html>
  )
}
