import Link from 'next/link'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'

export default function Accepted() {
  return (
    <>
      <SiteHeader />
      <main>
        <h1>{t.landing.acceptedTitle}</h1>
        <p>{t.landing.acceptedBody}</p>
        <p><Link className="mdx-download" href="/">{t.landing.backHome}</Link></p>
      </main>
      <SiteFooter />
    </>
  )
}
