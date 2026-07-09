import { readUnsubToken } from '@/lib/email/unsubscribe-token'
import { appendConsent } from '@/lib/registration/consents'
import { sessionSecret } from '@/lib/auth/secret'
import { t } from '@/lib/i18n'

// GET-с-побочным-эффектом (MAIL-06): переход из письма — по природе ссылки это GET, форму
// в письме не поставить. force-dynamic не даёт Next закэшировать/статически сгенерировать
// страницу, но НЕ защищает от email-сканеров антивирусов/спам-фильтров, которые сами кликают
// по ссылкам в письме до пользователя — известный компромисс отписки-в-один-клик, приемлемый
// для необязательной рассылки (в отличие от смены пароля/данных). Идемпотентно: appendConsent
// — append-only (D-014), повторный переход по той же ссылке просто дописывает ещё одну строку
// granted=false — безвредно, действующим остаётся всё то же «не подписан».
export const dynamic = 'force-dynamic'

export default async function Unsubscribe({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const email = readUnsubToken(token, sessionSecret())
  if (email) await appendConsent({ email, type: 'NEWSLETTER', granted: false, source: 'UNSUBSCRIBE_LINK' })
  return (
    <main>
      <h1>{email ? t.unsub.doneTitle : t.unsub.badTitle}</h1>
      <p>{email ? t.unsub.doneBody : t.unsub.badBody}</p>
    </main>
  )
}
