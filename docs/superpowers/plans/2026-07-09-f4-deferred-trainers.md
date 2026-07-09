# Ф4 «Отложенные квизы + тренажёры (T1)» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Студент с уроком, пройденным ≥7 дней назад, видит при входе блок «3 вопроса на 2 минуты» и сдаёт его (без cron, D-005); каталог тренажёров в кабинете; T1 «Собери запрос» работает через серверный прокси Anthropic с лимитами 20/день и 3/мин, мягкими отказами.

**Architecture:** lib/progress/deferred.ts (выборка due-блока при входе — CAB-04/06; запись результата — CAB-05); lib/trainers (limits: TrainerUsage-окна по Warsaw-дню и минуте; t1: прокси Anthropic, max_tokens 1000). Отложенный блок — отдельная страница /app/review (одна форма: 3 вопроса → результат с пояснениями). Каталог /app/trainers (TRN-06, без геймификации D-020), страница /app/trainers/t1 (server action чат-шаг). `<Trainer>` в уроке → карточка-ссылка на тренажёр (TRN-07: те же лимиты — общая страница/прокси; mode inline/link в Ф4 оба рендерятся ссылкой, полноценный inline — при спеках фабрики).

**Tech Stack:** + `@anthropic-ai/sdk` (официальный SDK; ANTHROPIC_API_KEY уже в render.yaml/env.example — SEC-04). Модель: `claude-sonnet-5` (текущая основная; вынести в константу MODEL).

**Спеки:** CAB-04…06, TRN-01…07, SEC-03/04, D-005/012/015/020; flows F5; seed.md Ф4; phases.md Ф4.

**Инварианты:** deferred НЕ меняет статусы уроков (CAB-05); лимиты в БД (D-015 — деньги API); ключ только на сервере (TRN-02); мягкие отказы без технических ошибок (TRN-04); прокси только студентам с enrollment (TRN-05); кириллица через t.

---

### Task 1: Deferred-логика (TDD чистой части)

**Files:** Create `lib/progress/deferred.ts`, `lib/progress/deferred.test.ts`

- [ ] Чистые функции + TDD:

```ts
export type DeferredRow = { id: string; lessonId: string; dueAt: Date; answeredAt: Date | null }

/** CAB-04/06: должный и несданный блок — самый давний по dueAt; null если нет. Сравнение по timestamp (dueAt хранится UTC; «7 дней» заложены при создании — LES-13). */
export function pickDueDeferred(rows: DeferredRow[], now: Date): DeferredRow | null
```
Тесты: пустой список → null; несданные с dueAt в будущем → null; два просроченных → самый давний; сданные (answeredAt) игнорируются.

- [ ] Prisma-слой в том же файле: `getDueDeferred(userId)` (findMany несданных + pickDueDeferred + подгрузка вопросов урока: quiz.deferred ?? quiz.questions — D-012, из getLesson; урок битый/пропал → пропустить строку (E10) и взять следующую давнюю); `answerDeferred(userId, deferredId, answers: StoredAnswer[])` — updateMany where {id, userId, answeredAt: null} (идемпотентность двойного сабмита: count!==1 → 'already'), score = scoreAnswers, статусы уроков НЕ трогаются (CAB-05). Тип DeferredQuestion = QuizQuestion.
- [ ] Прогоны + Commit `"Ф4: deferred-логика — выбор блока и запись результата (CAB-04…06, D-005/012)"` (+трейлер Co-Authored-By: Claude Fable 5 <noreply@anthropic.com> — везде).

---

### Task 2: Страница /app/review + блок в кабинете

**Files:** Create `app/app/review/page.tsx`, `app/actions/review.ts`; Modify `app/app/page.tsx`, `lib/i18n/ru.ts`, `components/cabinet.css`

- [ ] Кабинет: если getDueDeferred(user.id) не null → заметный crat-card блок (kicker t.review.kicker 'Повторение', заголовок t.review.cabinetTitle '3 вопроса на 2 минуты', подпись с названием урока, кнопка .crat-button.primary → /app/review). Один вызов, кэшировать не нужно.
- [ ] /app/review: getDueDeferred → нет → redirect /app; есть → форма: заголовок урока, 3 вопроса радио-группами (fieldset/legend, radio name=q0/q1/q2 required), submit → answerReviewAction (hidden deferredId).
- [ ] app/actions/review.ts: requireStudent-паттерн; собрать answers как StoredAnswer[] (correct вычисляет СЕРВЕР по вопросам блока — та же логика что recordAnswer: получи вопросы через getDueDeferred/getLesson повторно и сверь; вопросы могли смениться при обновлении контента — допустимо, сверка по индексам с guard'ами isValidChoice); answerDeferred → redirect /app/review/done?id=... НЕТ — проще: redirect /app/review?done={deferredId} и страница показывает результат: счёт + пояснения к каждому вопросу (из quiz-данных) + кнопка «В кабинет». 'already' → redirect /app.
- [ ] Строки ru.ts (review.*): kicker, cabinetTitle, lessonLabel 'Урок', submit 'Ответить', scoreLabel 'Результат', backToCabinet 'В кабинет', done-заголовки.
- [ ] Прогоны + Commit `"Ф4: блок повторения — /app/review и карточка в кабинете (CAB-04…06)"`.

---

### Task 3: Лимиты тренажёров (TDD чистой части)

**Files:** Create `lib/trainers/limits.ts`, `lib/trainers/limits.test.ts`

- [ ] Чистая логика окон + TDD:

```ts
export const DAILY_LIMIT = 20   // TRN-03, день по Europe/Warsaw
export const MINUTE_LIMIT = 3

/** Начало текущего дня по Warsaw в UTC-timestamp. */
export function warsawDayStart(now: Date): Date
export function checkWindows(usedAtList: Date[], now: Date): 'ok' | 'daily' | 'minute'
```
Тесты: warsawDayStart через границу суток (23:30 UTC зимой = 00:30 Warsaw следующего дня); checkWindows: 19 сегодня → ok; 20 сегодня → daily; 3 за минуту → minute; вчерашние не считаются; ровно 60с назад — не в минутном окне.

- [ ] Prisma-слой: `tryConsume(userId, trainerId)` — читает TrainerUsage за Warsaw-день, checkWindows, при ok — create запись, вернуть 'ok' | 'daily' | 'minute'. (Гонка двух запросов может дать 21-ю запись — приемлемо для anti-abuse, комментарий; не транзакционим.)
- [ ] Прогоны + Commit `"Ф4: лимиты тренажёров — окна день/минута по Warsaw (TRN-03, D-015)"`.

---

### Task 4: Прокси Anthropic для T1 (TRN-02/04/05)

**Files:** Create `lib/trainers/t1.ts`; Modify `package.json` (@anthropic-ai/sdk), `lib/i18n/ru.ts`

- [ ] `npm i @anthropic-ai/sdk`.
- [ ] lib/trainers/t1.ts:

```ts
import Anthropic from '@anthropic-ai/sdk'
import { tryConsume } from './limits'

const MODEL = 'claude-sonnet-5' // основная модель; смена — здесь
const MAX_TOKENS = 1000         // TRN-03

const SYSTEM = `Ты — тренажёр «Собери запрос» курса CRAT studio для взрослых без технической подготовки.
Студент присылает черновик запроса к нейросети. Твоя задача: (1) коротко скажи, что в запросе уже хорошо;
(2) задай 1–2 уточняющих вопроса ИЛИ предложи улучшенную версию запроса с объяснением, что изменилось и почему.
Пиши по-русски, тепло и уважительно, без техножаргона, без «это просто». Максимум ~150 слов.` // черновик до спек course-factory

export type T1Result = { ok: true; reply: string } | { ok: false; reason: 'daily' | 'minute' | 'error' }

/** TRN-02: ключ только на сервере; вызывается ТОЛЬКО после проверки enrollment (action). */
export async function askT1(userId: string, userText: string): Promise<T1Result> {
  const limit = await tryConsume(userId, 't1')
  if (limit !== 'ok') return { ok: false, reason: limit }
  try {
    const client = new Anthropic() // ANTHROPIC_API_KEY из env
    const msg = await client.messages.create({
      model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM,
      messages: [{ role: 'user', content: userText.slice(0, 2000) }],
    })
    const reply = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
    return reply ? { ok: true, reply } : { ok: false, reason: 'error' }
  } catch (e) {
    console.error('[t1] Anthropic error:', e)
    return { ok: false, reason: 'error' } // TRN-04: мягко, без технических деталей
  }
}
```
- [ ] Строки ru.ts (trainers.*): t1Title 'Собери запрос', t1Intro 'Напишите черновик запроса к нейросети — тренажёр подскажет, как сделать его точнее.', inputLabel 'Ваш запрос', send 'Отправить', limitDaily 'На сегодня запросы закончились — продолжим завтра.', limitMinute 'Слишком часто — подождите минуту и попробуйте снова.', error 'Тренажёр задумался и не ответил. Попробуйте ещё раз.', catalogTitle 'Тренажёры', comingSoon 'Скоро', t2Title 'Правда или нейросеть?', t3Title 'Опиши картинку', backToCabinet.
- [ ] Прогоны (SDK-вызов не тестируется юнитом; limits покрыты T3) + Commit `"Ф4: серверный прокси Anthropic для T1 с мягкими отказами (TRN-02…05)"`.

---

### Task 5: Каталог и страница T1 + Trainer-компонент

**Files:** Create `app/app/trainers/page.tsx`, `app/app/trainers/t1/page.tsx`, `app/actions/trainer.ts`; Modify `components/mdx/Trainer.tsx`, `lib/content/whitelist.ts`? (нет — id уже валидируются), `components/cabinet.css`, `app/app/page.tsx` (ссылка на каталог)

- [ ] /app/trainers (гейт layout + hasCourseAccess как у уроков — TRN-06 только студентам): 3 crat-card: T1 (описание t1Intro, кнопка «Открыть») ; T2/T3 — carточки с t.trainers.comingSoon (D-020: без публичной витрины, без геймификации).
- [ ] /app/trainers/t1: интро + форма textarea → askT1Action (hidden нет; лимиты внутри lib) → redirect с результатом? Ответ модели нельзя тащить через query. Решение: серверная страница + action, который кладёт результат... Без client-JS и без хранения — вариант: action рендерит результат через searchParams нельзя (длина). ПРИНЯТОЕ РЕШЕНИЕ (зафиксируй в отчёте): страница-form POST на саму себя НЕ поддерживается server actions без состояния; используем минимальный client-компонент с useActionState (первый 'use client' в проекте — оправдан интерактивным чатом; прогрессивная деградация: без JS форма всё равно отправится, вернётся страница с результатом через action → useActionState это и делает). Реализуй: `app/app/trainers/t1/T1Form.tsx` ('use client', useActionState(askT1Action)), action возвращает {reply?|message?}; страница — серверная обёртка. Отказы — message из t.trainers.* (сервер выбирает строку — action возвращает уже локализованный текст из словаря, НЕ ключ).
- [ ] app/actions/trainer.ts: askT1Action(prevState, formData) — requireStudent (enrollment! TRN-05), пустой ввод → message с просьбой написать текст, askT1 → {reply} | {message: t.trainers[limitDaily|limitMinute|error]}.
- [ ] components/mdx/Trainer.tsx: вместо заглушки — карточка-ссылка: название тренажёра по id (t.trainers.t1Title/t2Title/t3Title), короткая подпись, кнопка-ссылка на /app/trainers/{id} (T2/T3 — с пометкой comingSoon, без ссылки). mode: 'inline'|'link' — в Ф4 оба рендерят карточку (комментарий: полноценный inline — при спеках фабрики). Лимиты общие автоматически (одна страница/прокси — TRN-07).
- [ ] Кабинет: ссылка-кнопка на /app/trainers (t.trainers.catalogTitle) рядом с мини-проектом.
- [ ] Прогоны + smoke без БД (роуты собираются; /app/trainers → redirect /login без сессии) + Commit `"Ф4: каталог тренажёров, страница T1, Trainer-карточка в уроках (TRN-01/06/07, D-020)"`.

---

### Task 6: seed v4 + финальный прогон

**Files:** Modify `scripts/seed.ts`

- [ ] seedF4: у student@ — бэкдейт: LessonProgress 1.1 completedAt = −8 дней (update), DeferredQuizState 1.1 dueAt = −1 день, answeredAt null (update) → блок виден сразу; TrainerUsage 19 записей за сегодня (Warsaw) для (student, t1) → следующий запрос = 20-й ок, 21-й — daily-отказ... точнее 19 → ещё 1 ок → потом daily; создай ровно 19 (upsert-неидемпотентность: deleteMany usedAt сегодня + createMany 19 — детерминированно).
- [ ] Финальный прогон: typecheck/lint/test/build; seed без БД → catch exit 1. Commit `"Ф4: seed v4 — бэкдейт повторения, 19/20 лимита тренажёра"`.

---

## Внешние шаги Ивана
1. `ANTHROPIC_API_KEY` в Render Environment (уже в render.yaml sync:false — просто заполнить).
2. Smoke Ф4 из phases.md: блок «3 вопроса» у seed-студента → сдать → исчез, статусы не изменились; /app/trainers/t1 → ответ модели; 4 запроса подряд → мягкий отказ.
3. Спеки тренажёров из course-factory (T1-промпт финализируется, T2/T3 включатся) — не блокирует.

## Self-review
- CAB-04 (T1/T2: выборка при входе, Warsaw-«7 дней» заложены в dueAt при создании — LES-13, сравнение честное), CAB-05 (answerDeferred не трогает статусы; пояснения на done-экране), CAB-06 (pickDueDeferred самый давний, по одному), TRN-01 (каталог+T1, T2/T3 заглушки), TRN-02 (ключ сервер, SDK в lib), TRN-03 (limits + max_tokens), TRN-04 (мягкие строки), TRN-05 (requireStudent в action), TRN-06 (каталог за гейтом), TRN-07 (Trainer-карточка → общая страница/лимиты), D-012 (deferred ?? questions), D-015 (TrainerUsage в БД), D-020 (без геймификации/витрины).
- Первый 'use client' в проекте — T1Form (оправдание: интерактивный чат; useActionState с прогрессивной деградацией) — [РЕШЕНИЕ АВТОРА] в DECISIONS при исполнении не требуется, зафиксировано здесь.
- Порядок: T1→T2→T3→T4→T5→T6.
