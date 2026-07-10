import { readUnsubToken } from '@/lib/email/unsubscribe-token'
import { recordUnsubscribe } from '@/lib/registration/consents'
import { syncContactUnsubscribe } from '@/lib/resend-audience'
import { sessionSecret } from '@/lib/auth/secret'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'

// GET-с-побочным-эффектом (MAIL-06): переход из письма — по природе ссылки это GET, форму
// в письме не поставить. force-dynamic не даёт Next закэшировать/статически сгенерировать
// страницу, но НЕ защищает от email-сканеров антивирусов/спам-фильтров, которые сами кликают
// по ссылкам в письме до пользователя — известный компромисс отписки-в-один-клик, приемлемый
// для необязательной рассылки (в отличие от смены пароля/данных). recordUnsubscribe безопасен
// к таким кликам: повторный переход дописывает ещё одну append-only строку granted=false
// (D-014) — безвредно; для GDPR-удалённого субъекта (нет ни User, ни Registration) НИЧЕГО
// не пишется — вечный HMAC-токен не воскрешает email в базе (ревью T12), при этом ответ
// страницы одинаков в обоих случаях — существование адреса не раскрываем.
export const dynamic = 'force-dynamic'

export default async function Unsubscribe({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const email = readUnsubToken(token, sessionSecret())
  if (email) {
    const user = await recordUnsubscribe(email)
    // F17/CRM-04/05: Resend-синк — best-effort, сбой не должен ломать страницу отписки (отписка в БД уже прошла).
    if (user) await syncContactUnsubscribe(user).catch(e => console.error('[unsubscribe] Resend-синк отписки не удался (CRM-05):', e))
  }
  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <div className="crat-card accepted-card">
              <h1 className="crat-display">{email ? t.unsub.doneTitle : t.unsub.badTitle}</h1>
              <p className="crat-muted">{email ? t.unsub.doneBody : t.unsub.badBody}</p>
              {/* T8 дизайн-аудита (П2): битый токен — сразу дать способ написать нам, а не
                  оставлять текст «напишите нам» без единой ссылки. */}
              {!email && <a className="crat-button" href={`mailto:${t.footer.contactEmail}`}>{t.invite.contactCta}</a>}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
