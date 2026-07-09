import Link from 'next/link'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'

export default async function Invalid({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams
  return (
    <>
      <SiteHeader />
      <main>
        <h1>{reason === 'expired' ? t.auth.expiredTitle : t.auth.usedTitle}</h1>
        <p>{t.auth.invalidBody}</p>
        <p><Link className="mdx-download" href="/login">{t.auth.requestAgain}</Link></p>
      </main>
      <SiteFooter />
    </>
  )
}
