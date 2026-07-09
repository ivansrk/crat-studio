# Ф2 «Уроки + квизы + прогресс» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Тестовый студент проходит урок от видео до статуса «пройден»: кнопка «Завершить урок» открывает квиз-шаг с мгновенными пояснениями и пересдачами, практика отмечается чекбоксом, прогресс виден студенту и админу; при прохождении создаётся deferred_quiz_state (показ блока — Ф4).

**Architecture:** Глубокий модуль lib/progress (чистая логика квиза отдельно от Prisma-слоя). Квиз — полностью серверный (без client JS): каждый ответ = POST form → запись в QuizResult.answers → рендер пояснения → следующий вопрос. Попытка привязана к attemptId в URL; возврат без attemptId = новая попытка (LES-10). Определение «пройден» — ТОЛЬКО в lib/progress (D-004, правило 9).

**Tech Stack:** существующий стек Ф0/Ф1; новых зависимостей нет.

**Спеки:** requirements.md LES-01…14, CAB-01…03, ADM-05, SEC-05; flows.md F4, E5/E10/E16; data-model.md (LessonProgress, QuizResult, DeferredQuizState); seed.md Ф2; phases.md Ф2. CAB-04..06 (отложенные блоки) — Ф4; полный арт CAB-01 — Ф5.

**Ключевые правила для исполнителей:** «пройден» = quizPassedAt И practiceDoneAt (D-004) — вычисляется в одном месте; снятие практики НЕ отменяет сертификат (LES-11 — сертификатов ещё нет, но completedAt при снятии обнуляем? НЕТ: см. Task 2 Step 3 — completedAt остаётся, «пройден» для отображения = quizPassedAt && practiceDoneAt, completedAt фиксирует ПЕРВОЕ достижение и не откатывается, чтобы deferred/сертификат не ломались; расхождение бейджа и completedAt допустимо по E16); брошенная попытка не влияет ни на что (LES-10); все строки — ru.ts.

---

### Task 1: Чистая логика квиза (TDD)

**Files:**
- Create: `lib/progress/quiz-logic.ts`, `lib/progress/quiz-logic.test.ts`

- [ ] **Step 1: Failing-тесты**

```ts
import { describe, it, expect } from 'vitest'
import { scoreAnswers, isQuizPassed, nextQuestionIndex, PASS_SCORE, QUIZ_TOTAL, type StoredAnswer } from './quiz-logic'

const a = (questionIndex: number, chosen: number, correct: boolean): StoredAnswer => ({ questionIndex, chosen, correct })

describe('quiz-logic', () => {
  it('scoreAnswers считает только correct', () => {
    expect(scoreAnswers([a(0, 1, true), a(1, 0, false), a(2, 2, true)])).toBe(2)
    expect(scoreAnswers([])).toBe(0)
  })
  it('isQuizPassed: порог 2 из 3 (LES-08, D-004)', () => {
    expect(PASS_SCORE).toBe(2)
    expect(QUIZ_TOTAL).toBe(3)
    expect(isQuizPassed(2)).toBe(true)
    expect(isQuizPassed(3)).toBe(true)
    expect(isQuizPassed(1)).toBe(false)
  })
  it('nextQuestionIndex — первый неотвеченный; после трёх — null', () => {
    expect(nextQuestionIndex([])).toBe(0)
    expect(nextQuestionIndex([a(0, 1, true)])).toBe(1)
    expect(nextQuestionIndex([a(0, 1, true), a(1, 0, false), a(2, 2, true)])).toBeNull()
  })
  it('nextQuestionIndex терпит дыры/дубли (битые answers из базы): идёт по возрастанию', () => {
    expect(nextQuestionIndex([a(1, 0, true)])).toBe(0)
    expect(nextQuestionIndex([a(0, 1, true), a(0, 2, false)])).toBe(1)
  })
})
```

- [ ] **Step 2: Red.** **Step 3: `lib/progress/quiz-logic.ts`**

```ts
/** Чистая логика квиза — единственное место с порогом зачёта (D-004, LES-08). */
export const QUIZ_TOTAL = 3
export const PASS_SCORE = 2

export type StoredAnswer = { questionIndex: number; chosen: number; correct: boolean }

export const scoreAnswers = (answers: StoredAnswer[]): number => {
  const byQuestion = new Map<number, boolean>()
  for (const a of answers) if (!byQuestion.has(a.questionIndex)) byQuestion.set(a.questionIndex, a.correct)
  return [...byQuestion.values()].filter(Boolean).length
}

export const isQuizPassed = (score: number): boolean => score >= PASS_SCORE

/** Первый вопрос без ответа (0..2) или null, если отвечены все. Дубли ответа на вопрос игнорируются (первый побеждает). */
export function nextQuestionIndex(answers: StoredAnswer[]): number | null {
  const answered = new Set(answers.map(a => a.questionIndex))
  for (let i = 0; i < QUIZ_TOTAL; i++) if (!answered.has(i)) return i
  return null
}
```

- [ ] **Step 4: Green (77 → 81).** **Step 5: Commit** `"Ф2: чистая логика квиза — счёт, порог, следующий вопрос (LES-07/08)"` (+трейлер Co-Authored-By: Claude Fable 5 <noreply@anthropic.com> — далее во всех коммитах).

---

### Task 2: lib/progress — Prisma-слой (попытки, практика, completedAt, deferred)

**Files:**
- Create: `lib/progress/index.ts`
- Test: чистые хелперы уже покрыты (T1); Prisma-обёртки тонкие, без юнитов (нет локальной БД) — компенсируется live-smoke на Render.

- [ ] **Step 1: `lib/progress/index.ts`**

```ts
import { db } from '@/lib/db'
import { getLesson } from '@/lib/content'
import { scoreAnswers, isQuizPassed, nextQuestionIndex, QUIZ_TOTAL, type StoredAnswer } from './quiz-logic'
import type { QuizResult } from '@/lib/generated/prisma/client'

const COURSE = 'ai-basics'
const DEFERRED_DAYS_MS = 7 * 24 * 60 * 60 * 1000 // LES-13

/** LessonProgress создаётся при первом открытии урока (firstOpenedAt = default now). */
export async function ensureProgress(userId: string, lessonId: string) {
  return db.lessonProgress.upsert({
    where: { userId_courseSlug_lessonId: { userId, courseSlug: COURSE, lessonId } },
    update: {},
    create: { userId, courseSlug: COURSE, lessonId },
  })
}

/** LES-10: каждая новая попытка — новая строка; attempt = max+1 (гонка двух вкладок ловится @@unique). */
export async function startAttempt(userId: string, lessonId: string): Promise<QuizResult> {
  await ensureProgress(userId, lessonId)
  for (let tryN = 0; tryN < 2; tryN++) {
    const last = await db.quizResult.findFirst({ where: { userId, lessonId }, orderBy: { attempt: 'desc' } })
    try {
      return await db.quizResult.create({
        data: { userId, courseSlug: COURSE, lessonId, attempt: (last?.attempt ?? 0) + 1, answers: [] },
      })
    } catch (e) {
      const { isUniqueViolation } = await import('@/lib/db-errors')
      if (!isUniqueViolation(e) || tryN === 1) throw e // вторая вкладка успела — перечитываем max и пробуем ещё раз
    }
  }
  throw new Error('unreachable')
}

export type AnswerOutcome =
  | { ok: true; questionIndex: number; chosen: number; correct: boolean; finished: boolean; score: number; passed: boolean }
  | { ok: false; reason: 'not_found' | 'finished' | 'already_answered' | 'bad_option' }

/** Ответ на вопрос активной попытки. Правильность считает СЕРВЕР по quiz.yaml (LES-07). */
export async function recordAnswer(userId: string, lessonId: string, attemptId: string, questionIndex: number, chosen: number): Promise<AnswerOutcome> {
  const attempt = await db.quizResult.findFirst({ where: { id: attemptId, userId, lessonId } })
  if (!attempt) return { ok: false, reason: 'not_found' }
  if (attempt.finishedAt) return { ok: false, reason: 'finished' }
  const lesson = getLesson(lessonId)
  const question = lesson?.quiz.questions[questionIndex]
  if (!question || chosen < 0 || chosen >= question.options.length) return { ok: false, reason: 'bad_option' }

  const answers = (attempt.answers as StoredAnswer[] | null) ?? []
  if (nextQuestionIndex(answers) !== questionIndex) return { ok: false, reason: 'already_answered' } // отвечать можно только на текущий

  const correct = chosen === question.correct
  const newAnswers = [...answers, { questionIndex, chosen, correct }]
  const finished = nextQuestionIndex(newAnswers) === null
  const score = scoreAnswers(newAnswers)
  const passed = isQuizPassed(score)

  await db.quizResult.update({
    where: { id: attempt.id },
    data: { answers: newAnswers, score, total: QUIZ_TOTAL, passed, ...(finished ? { finishedAt: new Date() } : {}) },
  })
  if (finished && passed) await onQuizPassed(userId, lessonId) // LES-09: зачтённый остаётся зачтённым
  return { ok: true, questionIndex, chosen, correct, finished, score, passed }
}

/** Фиксация зачёта квиза + пересчёт «пройден». quizPassedAt не сбрасывается (LES-09). */
async function onQuizPassed(userId: string, lessonId: string) {
  await db.lessonProgress.update({
    where: { userId_courseSlug_lessonId: { userId, courseSlug: COURSE, lessonId } },
    data: { quizPassedAt: { set: new Date() } }, // ниже перетрём только если раньше был null — см. Step 2 fix
  })
  await recomputeCompletion(userId, lessonId)
}

/** LES-11: чекбокс практики; снятие → practiceDoneAt = null (completedAt НЕ откатывается — E16). */
export async function setPractice(userId: string, lessonId: string, done: boolean) {
  await ensureProgress(userId, lessonId)
  await db.lessonProgress.update({
    where: { userId_courseSlug_lessonId: { userId, courseSlug: COURSE, lessonId } },
    data: { practiceDoneAt: done ? new Date() : null },
  })
  if (done) await recomputeCompletion(userId, lessonId)
}

/** D-004/LES-12/13: единственная точка, где урок становится «пройден».
 *  completedAt ставится один раз (первое достижение) и не откатывается; deferred создаётся upsert'ом. */
export async function recomputeCompletion(userId: string, lessonId: string) {
  const p = await db.lessonProgress.findUnique({ where: { userId_courseSlug_lessonId: { userId, courseSlug: COURSE, lessonId } } })
  if (!p || p.completedAt || !p.quizPassedAt || !p.practiceDoneAt) return
  const completedAt = new Date()
  await db.lessonProgress.update({
    where: { userId_courseSlug_lessonId: { userId, courseSlug: COURSE, lessonId } },
    data: { completedAt },
  })
  await db.deferredQuizState.upsert({ // LES-13
    where: { userId_courseSlug_lessonId: { userId, courseSlug: COURSE, lessonId } },
    update: {},
    create: { userId, courseSlug: COURSE, lessonId, dueAt: new Date(completedAt.getTime() + DEFERRED_DAYS_MS) },
  })
}

export type LessonState = {
  quizPassed: boolean; practiceDone: boolean; completed: boolean
  attemptsCount: number
}

export async function getLessonState(userId: string, lessonId: string): Promise<LessonState> {
  const [p, attemptsCount] = await Promise.all([
    db.lessonProgress.findUnique({ where: { userId_courseSlug_lessonId: { userId, courseSlug: COURSE, lessonId } } }),
    db.quizResult.count({ where: { userId, lessonId } }),
  ])
  return {
    quizPassed: !!p?.quizPassedAt,
    practiceDone: !!p?.practiceDoneAt,
    completed: !!p?.quizPassedAt && !!p?.practiceDoneAt, // отображение «пройден» — живое (E16)
    attemptsCount,
  }
}

/** Кабинет/админка: карта lessonId → состояние + счётчик пройденных. */
export async function getCourseProgress(userId: string) {
  const rows = await db.lessonProgress.findMany({ where: { userId, courseSlug: COURSE } })
  const byLesson = new Map(rows.map(r => [r.lessonId, r]))
  return {
    byLesson,
    completedCount: rows.filter(r => r.quizPassedAt && r.practiceDoneAt).length,
  }
}
```

- [ ] **Step 2: Фикс quizPassedAt-перетирания.** В onQuizPassed нельзя перетирать существующий quizPassedAt (LES-09: «зачтённый остаётся зачтённым» — дата ПЕРВОГО зачёта). Замени update на условный:

```ts
await db.lessonProgress.updateMany({
  where: { userId, courseSlug: COURSE, lessonId, quizPassedAt: null },
  data: { quizPassedAt: new Date() },
})
```
(updateMany с фильтром quizPassedAt: null — идемпотентно и без гонок.)

- [ ] **Step 3: typecheck/lint/test (81). Commit** `"Ф2: lib/progress — попытки, практика, completedAt+deferred (LES-08…13, D-004)"`.

---

### Task 3: Доступ к урокам по enrollment (LES-06)

**Files:**
- Create: `lib/progress/access.ts`
- Modify: `app/app/lessons/[lessonId]/page.tsx` (гейт + ensureProgress)

- [ ] **Step 1: `lib/progress/access.ts`**

```ts
import { db } from '@/lib/db'
import { isAdminEmail } from '@/lib/auth/current-user'
import type { User } from '@/lib/generated/prisma/client'

/** LES-06: уроки доступны студенту с enrollment; админ видит всё (проверка контента). */
export async function hasCourseAccess(user: User, courseSlug = 'ai-basics'): Promise<boolean> {
  if (isAdminEmail(user.email)) return true
  const e = await db.enrollment.findUnique({ where: { userId_courseSlug: { userId: user.id, courseSlug } } })
  return !!e
}
```

- [ ] **Step 2: Страница урока** — в начале: `const user = await currentUser()` (не null — гейт layout), `if (!await hasCourseAccess(user)) redirect('/app')`; затем `await ensureProgress(user.id, lessonId)` при валидном уроке (создаёт firstOpenedAt). Кабинет `/app` покажет «нет доступа» позже (T5) — для Ф2 достаточно редиректа.

- [ ] **Step 3: проверки + Commit** `"Ф2: enrollment-гейт уроков + firstOpenedAt (LES-06)"`.

---

### Task 4: Страница урока — «Завершить урок», практика, миссия, следующий урок

**Files:**
- Modify: `app/app/lessons/[lessonId]/page.tsx`, `lib/i18n/ru.ts`
- Create: `app/actions/lesson.ts`, `lib/content/навигация — добавить в lib/content/index.ts хелпер nextLessonId`

- [ ] **Step 1: `nextLessonId` в lib/content/index.ts** (знание о порядке уроков — в lib/content):

```ts
/** Следующий урок по course.yaml или null для последнего. */
export function nextLessonId(lessonId: string): string | null {
  const ids = getContent().course.modules.flatMap(m => m.lessons.map(l => l.id))
  const i = ids.indexOf(lessonId)
  return i >= 0 && i + 1 < ids.length ? ids[i + 1] : null
}
```

- [ ] **Step 2: `app/actions/lesson.ts`**

```ts
'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { startAttempt, setPractice } from '@/lib/progress'
import { db } from '@/lib/db'

async function requireStudent() {
  const user = await currentUser()
  if (!user || !(await hasCourseAccess(user))) redirect('/login')
  return user
}

/** Кнопка «Завершить урок» (LES-01, D-019): создаёт попытку и ведёт в квиз-шаг. */
export async function startQuizAction(formData: FormData) {
  const user = await requireStudent()
  const lessonId = String(formData.get('lessonId'))
  const attempt = await startAttempt(user.id, lessonId)
  redirect(`/app/lessons/${lessonId}/quiz?attempt=${attempt.id}`)
}

export async function togglePracticeAction(formData: FormData) {
  const user = await requireStudent()
  const lessonId = String(formData.get('lessonId'))
  await setPractice(user.id, lessonId, formData.get('done') === 'on')
  revalidatePath(`/app/lessons/${lessonId}`)
}

/** LES-14/CAB-02: личная миссия — редактируема из урока 1.1 и кабинета. */
export async function saveMissionAction(formData: FormData) {
  const user = await requireStudent()
  const mission = String(formData.get('mission') ?? '').trim().slice(0, 2000)
  await db.user.update({ where: { id: user.id }, data: { mission: mission || null } })
  const returnTo = String(formData.get('returnTo') ?? '/app')
  redirect(['/app', '/app/lessons/1.1'].includes(returnTo) ? returnTo : '/app') // белый список
}
```

- [ ] **Step 3: страница урока** (после MDX и шпаргалки, ВМЕСТО disabled-кнопки):
- блок статуса: если quizPassed → «Квиз сдан ✓» (t.lesson.quizPassed) + кнопка «Пересдать» (та же startQuizAction, LES-09); иначе form startQuizAction c hidden lessonId + кнопка t.lesson.finishLesson;
- практика: `<section>` c practiceMd (markdown → рендер как простой текст в <pre>? НЕТ — practice.md это markdown: рендери через MDXRemote с mdxComponents тоже, контракт разрешает только markdown без компонентов — валидатор practice не проверяет на компоненты, но фабрика пишет plain markdown; используй MDXRemote для единообразия) + form togglePracticeAction с checkbox name="done" checked={state.practiceDone} + кнопка «Сохранить» (без JS чекбокс сам не сабмитится);
- урок пройден (state.completed) → бейдж t.lesson.completed «Урок пройден 🎉»;
- next: `nextLessonId(...)` → ссылка t.lesson.nextLesson или t.lesson.courseDone для последнего;
- миссия (lesson.meta.mission_prompt): form saveMissionAction с textarea name="mission" defaultValue={user.mission ?? ''} + hidden returnTo=/app/lessons/1.1 (LES-14).
- Строки в ru.ts: quizPassed 'Квиз сдан', retakeQuiz 'Пересдать квиз', practiceTitle 'Практика', practiceDone 'Сделал', save 'Сохранить', completed 'Урок пройден', nextLesson 'Следующий урок', courseDone 'Это был последний урок', missionTitle 'Моя личная миссия', missionHint 'Зачем я учусь работать с ИИ — своими словами'.

- [ ] **Step 4: проверки (typecheck/lint/test/build) + Commit** `"Ф2: страница урока — Завершить урок, практика, миссия, следующий (LES-01,09,11,14)"`.

---

### Task 5: Квиз-шаг (LES-07…10)

**Files:**
- Create: `app/app/lessons/[lessonId]/quiz/page.tsx`, `app/actions/quiz.ts`, `components/quiz.css` (+@import)
- Modify: `lib/i18n/ru.ts`

- [ ] **Step 1: `app/actions/quiz.ts`**

```ts
'use server'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { recordAnswer } from '@/lib/progress'

export async function answerAction(formData: FormData) {
  const user = await currentUser()
  if (!user || !(await hasCourseAccess(user))) redirect('/login')
  const lessonId = String(formData.get('lessonId'))
  const attemptId = String(formData.get('attemptId'))
  const questionIndex = Number(formData.get('questionIndex'))
  const chosen = Number(formData.get('chosen'))
  const r = await recordAnswer(user.id, lessonId, attemptId, questionIndex, chosen)
  if (!r.ok) redirect(`/app/lessons/${lessonId}`) // чужая/завершённая попытка → назад к уроку (новая начнётся кнопкой)
  redirect(`/app/lessons/${lessonId}/quiz?attempt=${attemptId}&feedback=${questionIndex}`)
}
```

- [ ] **Step 2: `quiz/page.tsx`** — серверная страница, состояние из БД:

```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'
import { hasCourseAccess } from '@/lib/progress/access'
import { db } from '@/lib/db'
import { getLesson } from '@/lib/content'
import { nextQuestionIndex, type StoredAnswer } from '@/lib/progress/quiz-logic'
import { answerAction } from '@/app/actions/quiz'
import { startQuizAction } from '@/app/actions/lesson'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export default async function QuizPage({ params, searchParams }: {
  params: Promise<{ lessonId: string }>; searchParams: Promise<{ attempt?: string; feedback?: string }>
}) {
  const { lessonId } = await params
  const { attempt: attemptId, feedback } = await searchParams
  const user = await currentUser()
  if (!user || !(await hasCourseAccess(user))) redirect('/login')
  const lesson = getLesson(lessonId)
  if (!lesson) notFound()
  if (!attemptId) redirect(`/app/lessons/${lessonId}`) // LES-10: прямой заход — назад, новая попытка только кнопкой

  const attempt = await db.quizResult.findFirst({ where: { id: attemptId, userId: user.id, lessonId } })
  if (!attempt) redirect(`/app/lessons/${lessonId}`)
  const answers = (attempt.answers as StoredAnswer[] | null) ?? []

  // Финальный экран
  if (attempt.finishedAt) {
    return (
      <main className="quiz">
        <h1>{attempt.passed ? t.quiz.passedTitle : t.quiz.failedTitle}</h1>
        <p>{t.quiz.scoreLabel}: {attempt.score}/{attempt.total}</p>
        {!attempt.passed && (
          <form action={startQuizAction}><input type="hidden" name="lessonId" value={lessonId} />
            <button className="mdx-download" type="submit">{t.lesson.retakeQuiz}</button></form>
        )}
        <p><Link className="mdx-download" href={`/app/lessons/${lessonId}`}>{t.quiz.backToLesson}</Link></p>
      </main>
    )
  }

  // Пояснение к только что отвеченному вопросу (?feedback=N)
  const fb = feedback !== undefined ? answers.find(a => a.questionIndex === Number(feedback)) : undefined
  const fbQuestion = fb ? lesson.quiz.questions[fb.questionIndex] : undefined

  const qi = nextQuestionIndex(answers)
  if (qi === null) redirect(`/app/lessons/${lessonId}/quiz?attempt=${attemptId}`) // рассинхрон: finish не записался — перерисуем
  const q = lesson.quiz.questions[qi]

  return (
    <main className="quiz">
      <h1>{lesson.meta.title} — {t.quiz.title}</h1>
      {fb && fbQuestion && (
        <aside className={fb.correct ? 'quiz-fb quiz-fb-ok' : 'quiz-fb quiz-fb-no'} role="status">
          <p>{fb.correct ? t.quiz.correct : t.quiz.incorrect}</p>
          <p>{fbQuestion.explanation}</p>
        </aside>
      )}
      <p className="quiz-progress">{t.quiz.questionLabel} {qi + 1}/3</p>
      <h2>{q.question}</h2>
      <div className="quiz-options">
        {q.options.map((opt, i) => (
          <form key={i} action={answerAction}>
            <input type="hidden" name="lessonId" value={lessonId} />
            <input type="hidden" name="attemptId" value={attempt.id} />
            <input type="hidden" name="questionIndex" value={qi} />
            <input type="hidden" name="chosen" value={i} />
            <button className="quiz-option" type="submit">{opt}</button>
          </form>
        ))}
      </div>
    </main>
  )
}
```
ВАЖНО: пояснение показывается ПОСЛЕ ответа на вопрос (LES-07) — здесь оно рендерится над СЛЕДУЮЩИМ вопросом (или финальный экран покажет общий счёт; пояснение к 3-му вопросу: redirect с feedback=2 приводит на финальный экран — там пояснение потеряется. Фикс: финальный экран тоже читает ?feedback и показывает пояснение последнего вопроса над результатом. Реализуй это.)

- [ ] **Step 3: строки ru.ts** — раздел quiz: title 'Проверка', questionLabel 'Вопрос', correct 'Верно!', incorrect 'Не совсем.', passedTitle 'Квиз сдан!', failedTitle 'Пока не хватило — попробуйте ещё раз', scoreLabel 'Результат', backToLesson 'Вернуться к уроку'.

- [ ] **Step 4: `components/quiz.css`** (+@import в globals.css): `.quiz-options { display: grid; gap: .8rem; } .quiz-option { text-align: left; font: inherit; background: var(--ink); color: var(--paper); border: 1px solid color-mix(in srgb, var(--paper) 25%, transparent); border-radius: 8px; padding: 1rem 1.25rem; cursor: pointer; width: 100%; } .quiz-option:hover { border-color: var(--neon); } .quiz-fb { padding: 1rem 1.25rem; border-radius: 8px; margin: 1rem 0; } .quiz-fb-ok { background: color-mix(in srgb, var(--mint) 12%, transparent); } .quiz-fb-no { background: color-mix(in srgb, var(--neon) 10%, transparent); } .quiz-progress { color: var(--lavender); }`

- [ ] **Step 5: проверки + Commit** `"Ф2: квиз-шаг — вопросы, мгновенные пояснения, пересдачи (LES-07…10)"`.

---

### Task 6: Кабинет — прогресс, статусы, миссия (CAB-01…03)

**Files:**
- Modify: `app/app/page.tsx`, `lib/i18n/ru.ts`
- Create: `components/cabinet.css` (+@import)

- [ ] **Step 1: app/app/page.tsx** — заменить каркас:
- `const user = await currentUser()` (гейт layout гарантирует); `hasCourseAccess(user)` → если нет: «Доступ выдаёт администратор» t.cabinet.noAccess (обычная страница, без редиректа) + logout;
- `const { byLesson, completedCount } = await getCourseProgress(user.id)`;
- CAB-01 (простая версия): `<section aria-label={t.cabinet.progressAria}>` полоса `.progress-track` с фигуркой `<span className="progress-figure" style={{ left: pct+'%' }} aria-hidden>🚶</span>` + текст `{completedCount}/12 · {t.cabinet.progressLabel}`; pct = completedCount/12*100;
- CAB-02: блок миссии — form saveMissionAction (textarea defaultValue user.mission, hidden returnTo=/app) + подпись t.lesson.missionTitle;
- CAB-03: список модулей/уроков со статусами: для каждого lessonId статус из byLesson: completed (quizPassedAt&&practiceDoneAt) → '✓ ' + t.cabinet.statusDone; иначе есть строка прогресса → t.cabinet.statusInProgress; иначе t.cabinet.statusNotStarted. Ссылки на уроки как раньше; logout-форма внизу остаётся.
- Строки ru.ts (cabinet): noAccess 'Доступ к курсу выдаёт администратор — мы напишем вам, когда всё будет готово.', progressLabel 'уроков пройдено', progressAria 'Прогресс по курсу', statusDone 'пройден', statusInProgress 'в процессе', statusNotStarted 'не начат'.

- [ ] **Step 2: `components/cabinet.css`**: `.progress-track { position: relative; height: 2.2rem; border-bottom: 2px solid color-mix(in srgb, var(--paper) 30%, transparent); margin: 1rem 0 2rem; } .progress-figure { position: absolute; bottom: 0; transition: left .6s ease; font-size: 1.6rem; }` (фигурка на «горизонте» — семантический задел под арт Ф5).

- [ ] **Step 3: проверки + smoke без БД (страница /app требует юзера — проверь редирект). Commit** `"Ф2: кабинет — прогресс с фигуркой, статусы, миссия (CAB-01…03)"`.

---

### Task 7: Прогресс студентов в админке (ADM-05)

**Files:**
- Create: `app/admin/students/[userId]/page.tsx`
- Modify: `app/admin/students/page.tsx` (ссылка «прогресс»), `lib/i18n/ru.ts`

- [ ] **Step 1: детальная страница** `/admin/students/[userId]`: гейт наследуется от layout; `db.user.findUnique` + `getCourseProgress(userId)` + `db.deferredQuizState.findMany({where:{userId}})`; таблица 12 уроков из course.yaml: колонки урок / квиз (✓+дата formatDate или '—') / практика / пройден; блок миссии (текст или '—'); блок отложенных: lessonId + dueAt + answeredAt; мини-проект: t.admin.projectPhase3 'Мини-проект появится в следующем обновлении' (Ф3); сертификат: аналогично. Строки в ru.ts (admin): progress 'Прогресс', colLesson 'Урок', colQuiz 'Квиз', colPractice 'Практика', colDone 'Пройден', mission 'Миссия', deferredTitle 'Отложенные вопросы', projectPhase3 (выше), notYet '—'.
- [ ] **Step 2: ссылка** t.admin.progress на каждой строке students-таблицы → /admin/students/{id}.
- [ ] **Step 3: проверки + Commit** `"Ф2: прогресс студента в админке (ADM-05)"`.

---

### Task 8: seed v2 + финальный прогон

**Files:**
- Modify: `scripts/seed.ts`

- [ ] **Step 1: блок Ф2** (docs/seed.md; идемпотентно через upsert по натуральным ключам): у `student@seed.crat.example`:
- уроки 1.1, 1.2 пройдены: LessonProgress upsert c quizPassedAt/practiceDoneAt/completedAt (даты «сейчас»), QuizResult attempt 1 проваленная (score 1, passed false, finishedAt), attempt 2 зачтённая (score 3, passed true, finishedAt), answers валидной формы StoredAnswer[];
- DeferredQuizState для 1.1/1.2 (dueAt = +7д) — upsert;
- урок 1.3: quizPassedAt есть, practiceDoneAt null (в процессе) + одна зачтённая попытка;
- одна брошенная попытка по 1.4: attempt 1, answers по одному вопросу, finishedAt null;
- mission: 'Хочу уверенно использовать ИИ в работе с документами' (update user).
- [ ] **Step 2: финальный прогон** typecheck/lint/test/build + грамматический seed без БД (ловится catch). **Commit** `"Ф2: seed v2 — прогресс, попытки, брошенный квиз"`.

---

## Внешние шаги Ивана (закрытие Ф2, phases.md)
1. Прогнать smoke-чеклист Ф2 на проде (после деплоя + `npm run seed`).
2. Тестовый video_id Kinescope — вставить в meta.yaml любого урока (проверка плеера); реальные уроки придут из course-factory позже.

## Self-review
- Покрытие: LES-01 (T4 порядок+кнопка), LES-06 (T3), LES-07/08 (T1/T5), LES-09 (T2 updateMany-фикс + пересдача T4/T5), LES-10 (T2 startAttempt + T5 redirect-логика), LES-11 (T2 setPractice, E16 — completedAt не откатывается), LES-12 (T2 recompute, D-004 одна точка), LES-13 (T2 deferred upsert), LES-14 (T4 миссия), CAB-01/02/03 (T6), ADM-05 (T7), seed Ф2 (T8). LES-02…05 — готовы с Ф0.
- Типы: StoredAnswer единый (T1) — используется T2/T5/T8; attemptId — QuizResult.id (cuid) в URL — не секрет (принадлежность проверяется по userId в каждом действии).
- Порядок: T1→T2→T3→T4→T5→T6→T7→T8 (T5 зависит от T4-actions; T6/T7 от T2).
