import type { Metadata } from 'next'
import { currentUser } from '@/lib/auth/current-user'
import { consultAction } from '@/app/actions/consultation'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'

export const metadata: Metadata = {
  title: t.consult.title,
  alternates: { canonical: '/consult' },
}

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
            <SectionLabel kicker={tc.kicker} />
            <h1 className="crat-display">{tc.title}</h1>
            <p className="crat-muted section-intro">{tc.offerText}</p>

            <form action={consultAction} className="signup-form crat-card">
              {notice && (
                <p role="alert" className="form-alert">{notice === 'rate' ? tc.rateLimited : tc.invalid}</p>
              )}
              <label>
                <span>{tc.fieldName}</span>
                <input name="name" required autoComplete="name" defaultValue={user ? `${user.firstName} ${user.lastName}`.trim() : ''} />
              </label>
              <label>
                <span>{tc.fieldContact}</span>
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
                <span>{tc.fieldMessage}</span>
                <textarea name="message" required maxLength={2000} rows={5} />
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
