import { readUnsubToken } from '@/lib/email/unsubscribe-token'
import { recordUnsubscribe } from '@/lib/registration/consents'
import { sessionSecret } from '@/lib/auth/secret'
import { t } from '@/lib/i18n'

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
  if (email) await recordUnsubscribe(email)
  return (
    <main>
      <h1>{email ? t.unsub.doneTitle : t.unsub.badTitle}</h1>
      <p>{email ? t.unsub.doneBody : t.unsub.badBody}</p>
    </main>
  )
}
