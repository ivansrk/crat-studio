import { requestLinkAction } from '@/app/actions/request-link'
import { t } from '@/lib/i18n'

export default function Login() {
  return (
    <main>
      <h1>{t.auth.title}</h1>
      <form action={requestLinkAction} className="signup-form">
        <label>{t.auth.emailLabel}<input name="email" type="email" required autoComplete="email" /></label>
        <button type="submit" className="mdx-download">{t.auth.submit}</button>
      </form>
    </main>
  )
}
