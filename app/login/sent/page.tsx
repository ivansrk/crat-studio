import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'

export default function Sent() {
  return (
    <>
      <SiteHeader />
      <main>
        <h1>{t.auth.sentTitle}</h1>
        <p>{t.auth.sentBody}</p>
      </main>
      <SiteFooter />
    </>
  )
}
