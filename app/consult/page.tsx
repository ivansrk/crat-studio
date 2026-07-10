import type { Metadata } from 'next'
import Link from 'next/link'
import { currentUser } from '@/lib/auth/current-user'
import { consultAction } from '@/app/actions/consultation'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'
import { SectionShader } from '@/components/site/SectionShader'

export const metadata: Metadata = {
  title: t.consult.title,
  alternates: { canonical: '/consult' },
}

// impeccable P1-3: конвенция обязательных полей с components/signup-form.tsx (звёздочки
// у required-полей + пояснение над формой) — раньше /consult не показывал обязательность
// полей визуально, хотя server action (consultAction) её требует.
const Req = () => <span aria-hidden="true"> *</span>

/**
 * Ф7б Task 8, CONS-01/02/05/06: публичная форма заявки на консультацию — точка входа с главной
 * (#contact) и из кабинета (MC-03, блок в app/app/page.tsx). Страница публична (доступна без
 * сессии), но у залогиненного юзера префиллит имя/email из профиля (email — единственное поле,
 * гарантированно заполненное у любого User; телефон/telegram опциональны).
 */
export default async function Consult({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams
  const notice = sent === 'invalid' || sent === 'rate' ? sent : undefined
  const user = await currentUser()
  const tc = t.consult

  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            {/* T2 дизайн-аудита (D-042): шейдер держит только заголовок+интро,
                форму ниже не перекрывает — см. site.css .section-shader--consult-blob. */}
            <div className="shader-scope">
              <SectionShader variant="consult-blob" />
              <div className="shader-content">
                <SectionLabel kicker={tc.kicker} />
                <h1 className="crat-display">{tc.title}</h1>
                <p className="crat-muted section-intro">{tc.offerText}</p>
              </div>
            </div>

            <form action={consultAction} className="signup-form crat-card">
              {notice && (
                <p role="alert" className="form-alert">{notice === 'rate' ? tc.rateLimited : tc.invalid}</p>
              )}
              <p className="crat-muted">{tc.requiredNote}</p>
              <label>
                <span>{tc.fieldName}<Req /></span>
                <input name="name" required autoComplete="name" defaultValue={user ? `${user.firstName} ${user.lastName}`.trim() : ''} />
              </label>
              <label>
                <span>{tc.fieldContact}<Req /></span>
                <input name="contact" required defaultValue={user?.email ?? ''} />
              </label>
              <label>
                <span>{tc.fieldTopic}</span>
                <select name="topic" defaultValue="">
                  <option value="" disabled>{tc.fieldTopicPlaceholder}</option>
                  {Object.entries(tc.topicOptions).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>{tc.fieldMessage}<Req /></span>
                <textarea name="message" required maxLength={2000} rows={5} />
              </label>
              {/* M3 (ревью Ф7в, LEGAL-05): та же обязательная галка согласия, что в signup-form.tsx —
                  без Consent-журнала (это не подписка, достаточно required-чекбокса по брифу).
                  impeccable P1-3: звёздочка добавлена и сюда — /consult отмечает обязательность
                  явно (текст «(обязательно)» внутри dataConsent.after остаётся как есть). */}
              <label className="check">
                <input type="checkbox" name="dataConsent" required />
                <span>
                  {tc.dataConsent.before}
                  <Link href="/privacy" target="_blank" rel="noopener">{tc.dataConsent.privacyLabel}</Link>
                  {tc.dataConsent.between}
                  <Link href="/terms" target="_blank" rel="noopener">{tc.dataConsent.termsLabel}</Link>
                  {tc.dataConsent.after}
                  <Req />
                </span>
              </label>
              <button type="submit" className="crat-button primary">{tc.submit}</button>
            </form>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
