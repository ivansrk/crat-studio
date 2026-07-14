'use client'
import { useActionState } from 'react'
import { askT2Action, type T2FormState } from '@/app/actions/trainer'
import { t } from '@/lib/i18n'

/** TRN-08: T2 «Дожми ответ» — та же useActionState-прогрессивная деградация, что T1Form (без JS
 *  форма постится на askT2Action, страница перерисовывается с готовым state). Отличие от T1 —
 *  два шага в одном компоненте: пока в state нет stage, показываем форму промпта; когда появился
 *  stage:'first' — первый ответ + форма уточнения; stage:'refined' — финал (второй ответ + разбор).
 *  Состояние диалога живёт только в этом state, БД его не хранит (D-042) — prompt/firstAnswer
 *  переносятся на второй submit hidden-полями, третьего submit («ещё уточнить») в TRN-08 нет. */
export function T2Form() {
  const [state, formAction, pending] = useActionState<T2FormState, FormData>(askT2Action, {})
  const pristine = !state.stage && !state.message

  if (state.stage === 'refined') {
    return (
      <>
        <div className="crat-card trainer-reply">
          <p className="trainer-reply-label">{t.trainers.t2FirstAnswerLabel}</p>
          <p className="trainer-reply-text">{state.firstAnswer}</p>
        </div>
        <div className="crat-card trainer-reply">
          <p className="trainer-reply-label">{t.trainers.t2RefinedAnswerLabel}</p>
          <p className="trainer-reply-text">{state.refinedAnswer}</p>
        </div>
        {/* Обычная ссылка, не клиентский сброс state — намеренно полная перезагрузка страницы
         *  (не next/link): и форма (useActionState живёт в памяти компонента), и счётчик
         *  «осталось N из 20» возвращаются к актуальному состоянию с сервера. next/link на тот же
         *  URL в App Router — no-op без query-параметра, а компонент бы не размонтировался. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <p><a className="crat-button primary" href="/app/trainers/t2">{t.trainers.t2StartOver}</a></p>
      </>
    )
  }

  return (
    <>
      {!state.stage && (
        <form action={formAction} className="crat-card trainer-form">
          <input type="hidden" name="step" value="first" />
          <label htmlFor="t2-prompt">{t.trainers.t2PromptLabel}</label>
          <textarea id="t2-prompt" name="prompt" required />
          {pristine && <p className="trainer-example crat-muted">{t.trainers.emptyExample}</p>}
          <p className="trainer-submit-row">
            <button className="crat-button primary" type="submit" disabled={pending}>{t.trainers.t2GetAnswer}</button>
            {pending && <span className="trainer-pending" role="status">{t.trainers.pending}</span>}
          </p>
        </form>
      )}

      {state.stage === 'first' && (
        <>
          <div className="crat-card trainer-reply">
            <p className="trainer-reply-label">{t.trainers.t2FirstAnswerLabel}</p>
            <p className="trainer-reply-text">{state.firstAnswer}</p>
          </div>
          <form action={formAction} className="crat-card trainer-form">
            <input type="hidden" name="step" value="refine" />
            <input type="hidden" name="prompt" value={state.prompt} />
            <input type="hidden" name="firstAnswer" value={state.firstAnswer} />
            <label htmlFor="t2-followup">{t.trainers.t2FollowUpLabel}</label>
            <textarea id="t2-followup" name="followUp" required />
            <p className="trainer-example crat-muted">{t.trainers.t2FollowUpExample}</p>
            <p className="trainer-submit-row">
              <button className="crat-button primary" type="submit" disabled={pending}>{t.trainers.t2Refine}</button>
              {pending && <span className="trainer-pending" role="status">{t.trainers.pending}</span>}
            </p>
          </form>
        </>
      )}

      {state.message && (
        <p role="alert" className="form-alert">{state.message}</p>
      )}
    </>
  )
}
