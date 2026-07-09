import { registerAction } from '@/app/actions/register'
import { t } from '@/lib/i18n'

const Req = () => <span aria-hidden="true"> *</span>

export function SignupForm({ notice, returnTo, showTitle = true }: { notice?: 'invalid' | 'rate'; returnTo?: string; showTitle?: boolean }) {
  return (
    <form id="signup" action={registerAction} className="signup-form crat-card">
      {showTitle && <h2 className="crat-display">{t.landing.signupTitle}</h2>}
      <p className="crat-muted">{t.landing.signupNote}</p>
      <p className="crat-muted">{t.landing.requiredNote}</p>
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {notice && <p role="alert" className="form-alert">{notice === 'rate' ? t.landing.rate : t.landing.invalid}</p>}
      <label><span>{t.landing.firstName}<Req /></span><input name="firstName" required autoComplete="given-name" /></label>
      <label><span>{t.landing.lastName}<Req /></span><input name="lastName" required autoComplete="family-name" /></label>
      <label><span>{t.landing.email}<Req /></span><input name="email" type="email" required autoComplete="email" /></label>
      <label>{t.landing.phone}<input name="phone" autoComplete="tel" /></label>
      <label>{t.landing.telegram}<input name="telegram" /></label>
      <label className="check"><input type="checkbox" name="dataConsent" required /> {t.landing.dataConsent}</label>
      <label className="check"><input type="checkbox" name="newsletterConsent" /> {t.landing.newsletterConsent}</label>
      <button type="submit" className="crat-button primary">{t.landing.submit}</button>
    </form>
  )
}
