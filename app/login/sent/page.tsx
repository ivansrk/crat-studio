import { t } from '@/lib/i18n'

export default function Sent() {
  return (
    <main>
      <h1>{t.auth.sentTitle}</h1>
      <p>{t.auth.sentBody}</p>
    </main>
  )
}
