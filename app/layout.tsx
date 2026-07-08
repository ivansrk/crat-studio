import type { Metadata } from 'next'
import { accent, body, mono } from './fonts'
import { t } from '@/lib/i18n'
import './globals.css'

export const metadata: Metadata = { title: t.site.title }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${accent.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
