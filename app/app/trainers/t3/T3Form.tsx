'use client'
import { useActionState } from 'react'
import { evaluateT3Action, type T3FormState } from '@/app/actions/trainer'
import { t } from '@/lib/i18n'

type PublicTask = { id: string; topic: string; text: string }

/** TRN-09: T3 «Найди ошибку» — один шаг «Проверить» (в отличие от двух шагов T2): задание уже
 *  показано (page.tsx выбрало его по ?i= из фиксированного пула), студент пишет, что показалось
 *  неверным, и получает вердикт+разбор одним вызовом модели. «Следующее задание»/«Ещё раз это» —
 *  обычные ссылки на другой ?i=, полная перезагрузка (паттерн T2Form «Начать заново»): ротация —
 *  не то, что должно жить в клиентском состоянии, useActionState тут только про вызов модели. */
export function T3Form({ task, index, nextIndex }: { task: PublicTask; index: number; nextIndex: number }) {
  const [state, formAction, pending] = useActionState<T3FormState, FormData>(evaluateT3Action, {})

  return (
    <>
      <p className="crat-kicker trainer-t3-topic">{task.topic}</p>
      <div className="crat-card crat-frame-gradient trainer-t3-frame">
        <p className="trainer-t3-frame-label">{t.trainers.t3FrameLabel}</p>
        <p className="trainer-reply-text">{task.text}</p>
      </div>

      {!state.verdict && (
        <form action={formAction} className="crat-card trainer-form">
          <input type="hidden" name="taskId" value={task.id} />
          <label htmlFor="t3-answer">{t.trainers.t3AnswerLabel}</label>
          <textarea id="t3-answer" name="answer" required />
          <p className="trainer-example crat-muted">{t.trainers.t3AnswerExample}</p>
          <p className="trainer-submit-row">
            <button className="crat-button primary" type="submit" disabled={pending}>{t.trainers.t3Check}</button>
            {pending && <span className="trainer-pending" role="status">{t.trainers.pending}</span>}
          </p>
        </form>
      )}

      {state.verdict && (
        <>
          <div className="crat-card trainer-reply">
            <p className="trainer-reply-label">{t.trainers.t3VerdictLabel}</p>
            <p className="trainer-reply-text">{state.verdict}</p>
          </div>
          <p className="trainer-submit-row">
            {/* Обычные ссылки, не клиентский сброс state — та же причина, что «Начать заново» в
             *  T2Form: useActionState живёт только в памяти компонента, а счётчик «осталось N из 20»
             *  и следующее задание должны прийти свежими с сервера; next/link на тот же URL —
             *  no-op без нового query-параметра, а компонент бы не размонтировался. Динамический
             *  href (template literal) — @next/next/no-html-link-for-pages его не распознаёт как
             *  внутренний маршрут, eslint-disable тут не нужен (в отличие от T2Form). */}
            <a className="crat-button primary" href={`/app/trainers/t3?i=${nextIndex}`}>{t.trainers.t3NextTask}</a>
            <a className="crat-button" href={`/app/trainers/t3?i=${index}`}>{t.trainers.t3RetryTask}</a>
          </p>
        </>
      )}

      {state.message && (
        <p role="alert" className="form-alert">{state.message}</p>
      )}
    </>
  )
}
