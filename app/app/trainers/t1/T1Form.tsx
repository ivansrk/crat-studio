'use client'
import { useActionState } from 'react'
import { askT1Action, type T1FormState } from '@/app/actions/trainer'
import { t } from '@/lib/i18n'

/** Ф4 T5: первый по-настоящему интерактивный client-компонент проекта — тренажёр-чат
 *  требует показать ответ модели без перезагрузки страницы через query (нельзя тащить
 *  произвольный текст в URL). useActionState даёт прогрессивную деградацию: без JS форма
 *  всё равно постится на askT1Action, страница просто перерисуется с готовым state
 *  (это и есть работа useActionState на сервере при обычном submit). */
export function T1Form() {
  const [state, formAction, pending] = useActionState<T1FormState, FormData>(askT1Action, {})
  // T5 дизайн-аудита: пустое состояние — ни ответа, ни ошибки ещё не было (первый заход
  // или после сброса формы браузером) — показываем пример запроса, чтобы не начинать
  // с чистого листа (аудитория без техподготовки).
  const pristine = !state.reply && !state.message

  return (
    <>
      <form action={formAction} className="crat-card trainer-form">
        <label htmlFor="t1-text">{t.trainers.inputLabel}</label>
        <textarea id="t1-text" name="text" required />
        {pristine && <p className="trainer-example crat-muted">{t.trainers.emptyExample}</p>}
        <p className="trainer-submit-row">
          <button className="crat-button primary" type="submit" disabled={pending}>{t.trainers.send}</button>
          {/* T5: «Модель отвечает…» — pending уже был из useActionState, тут только видимый лоадер. */}
          {pending && <span className="trainer-pending" role="status">{t.trainers.pending}</span>}
        </p>
      </form>

      {state.reply && (
        <div className="crat-card trainer-reply">
          <p className="trainer-reply-text">{state.reply}</p>
        </div>
      )}
      {state.message && (
        <p role="alert" className="form-alert">{state.message}</p>
      )}
    </>
  )
}
