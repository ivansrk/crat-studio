import { registerAction } from '@/app/actions/register'
import { t } from '@/lib/i18n'

export function SignupForm({ notice }: { notice?: 'invalid' | 'rate' }) {
  return (
    <form id="signup" action={registerAction} className="signup-form">
      <h2>{t.landing.signupTitle}</h2>
      <p>{t.landing.signupNote}</p>
      {notice && <p role="alert" className="form-alert">{notice === 'rate' ? t.landing.rate : t.landing.invalid}</p>}
      <label>{t.landing.firstName}<input name="firstName" required autoComplete="given-name" /></label>
      <label>{t.landing.lastName}<input name="lastName" required autoComplete="family-name" /></label>
      <label>{t.landing.email}<input name="email" type="email" required autoComplete="email" /></label>
      <label>{t.landing.phone}<input name="phone" autoComplete="tel" /></label>
      <label>{t.landing.telegram}<input name="telegram" /></label>
      <label className="check"><input type="checkbox" name="dataConsent" required /> {t.landing.dataConsent}</label>
      <label className="check"><input type="checkbox" name="newsletterConsent" /> {t.landing.newsletterConsent}</label>
      <button type="submit" className="mdx-download">{t.landing.submit}</button>
    </form>
  )
}
