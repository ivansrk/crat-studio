'use client'
import { useState } from 'react'
import { answerAction } from '@/app/actions/quiz'
import { t } from '@/lib/i18n'

/** T5 дизайн-аудита: «двухшаговый ответ» (бриф §9) — раньше каждый вариант был
 *  своей формой с submit-кнопкой (клик = ответ, без возможности передумать).
 *  Теперь один <form>, варианты — radio (стилизованы как карточки, quiz.css),
 *  отдельная кнопка «Ответить» — disabled, пока ничего не выбрано. Контракт
 *  answerAction/recordAnswer НЕ менялся: тот же набор полей формы (courseSlug/
 *  lessonId/attemptId/questionIndex/chosen), recordAnswer уже идемпотентен
 *  к повторной отправке того же ответа (см. lib/progress/index.ts) — здесь
 *  меняется только разметка/UX выбора, не серверная логика. */
export function QuizAnswerForm({
  courseSlug, lessonId, attemptId, questionIndex, options,
}: {
  courseSlug: string
  lessonId: string
  attemptId: string
  questionIndex: number
  options: string[]
}) {
  const [chosen, setChosen] = useState<number | null>(null)

  return (
    <form action={answerAction} className="quiz-options">
      <input type="hidden" name="courseSlug" value={courseSlug} />
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="attemptId" value={attemptId} />
      <input type="hidden" name="questionIndex" value={questionIndex} />
      <div className="quiz-options-list">
        {options.map((opt, i) => (
          <label key={i} className={`quiz-option${chosen === i ? ' quiz-option-checked' : ''}`}>
            <input
              type="radio"
              name="chosen"
              value={i}
              checked={chosen === i}
              onChange={() => setChosen(i)}
              required
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>
      <button className="crat-button primary quiz-answer-submit" type="submit" disabled={chosen === null}>
        {t.quiz.answerSubmit}
      </button>
    </form>
  )
}
