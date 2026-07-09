import Link from 'next/link'
import { t } from '@/lib/i18n'

export default function Accepted() {
  return (
    <main>
      <h1>{t.landing.acceptedTitle}</h1>
      <p>{t.landing.acceptedBody}</p>
      <p><Link className="mdx-download" href="/">{t.home.heroTitle}</Link></p>
    </main>
  )
}
