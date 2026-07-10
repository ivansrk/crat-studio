import Link from 'next/link'
import { registerAction } from '@/app/actions/register'
import { t } from '@/lib/i18n'

const Req = () => <span aria-hidden="true"> *</span>

export type SignupNotice = 'invalid' | 'rate' | 'already'

/** REG-10: форма заявки — общая для публичного лендинга/страницы /register и приглашений
 *  /invite/{token} (inviteToken прокидывается hidden-полем, форма одна на оба места). */
export function SignupForm({ notice, returnTo, showTitle = true, inviteToken }: {
  notice?: SignupNotice; returnTo?: string; showTitle?: boolean; inviteToken?: string
}) {
  return (
    <form id="signup" action={registerAction} className="signup-form crat-card">
      {showTitle && <h2 className="crat-display">{t.landing.signupTitle}</h2>}
      <p className="crat-muted">{t.landing.signupNote}</p>
      <p className="crat-muted">{t.landing.requiredNote}</p>
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {inviteToken && <input type="hidden" name="inviteToken" value={inviteToken} />}
      {notice === 'already' ? (
        <p role="alert" className="form-alert">
          {t.landing.already} <Link href="/login">{t.landing.alreadyLoginLink}</Link>
        </p>
      ) : notice && (
        <p role="alert" className="form-alert">{notice === 'rate' ? t.landing.rate : t.landing.invalid}</p>
      )}
      <label><span>{t.landing.firstName}<Req /></span><input name="firstName" required autoComplete="given-name" /></label>
      <label><span>{t.landing.lastName}<Req /></span><input name="lastName" required autoComplete="family-name" /></label>
      <label><span>{t.landing.email}<Req /></span><input name="email" type="email" required autoComplete="email" /></label>
      <label><span>{t.landing.phone}<Req /></span><input name="phone" type="tel" required autoComplete="tel" /></label>
      <label>{t.landing.telegram}<input name="telegram" /></label>
      <label>{t.landing.whatsapp}<input name="whatsapp" /></label>
      <label className="check">
        <input type="checkbox" name="dataConsent" required />
        <span>
          {t.landing.dataConsent.before}
          <Link href="/privacy" target="_blank" rel="noopener">{t.landing.dataConsent.privacyLabel}</Link>
          {t.landing.dataConsent.between}
          <Link href="/terms" target="_blank" rel="noopener">{t.landing.dataConsent.termsLabel}</Link>
          {t.landing.dataConsent.after}
        </span>
      </label>
      <label className="check"><input type="checkbox" name="wantsNewsletter" /> {t.landing.newsletterConsent}</label>
      <button type="submit" className="crat-button primary">{t.landing.submit}</button>
    </form>
  )
}
