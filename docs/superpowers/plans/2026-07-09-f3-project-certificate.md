# Ф3 «Мини-проект + сертификат + письма» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полный путь до сертификата: студент сдаёт мини-проект → админ проверяет (approve/needs_changes с optimistic concurrency) → при 12/12 живых уроков И approved выдаётся сертификат CRAT-{год}-{NNNN} → PDF письмом и в кабинете → публичная проверка /cert/{номер}; GDPR-отзыв уже работает (Ф1).

**Architecture:** lib/project (сабмишены, D-016: пересдача = новая строка) и lib/cert (номер транзакционно через CertificateCounter FOR UPDATE, выдача-идемпотентность «один VALID на юзера», PDF по требованию Playwright — D-011). Триггер CERT-01 на двух событиях: approve (админ-action) и «урок пройден» (recomputeCompletion → dynamic import lib/cert, чтобы не создавать статический цикл lib/progress↔lib/cert).

**Tech Stack:** + `playwright` (только chromium; на Render — `npx playwright install chromium` в buildCommand, риск-зона: проверить на первом деплое). Resend attachments для PDF-письма.

**Спеки:** requirements.md PROJ-01…06, ADM-06/07, CERT-01…07, MAIL (CERTIFICATE); flows.md F6/F7, E7/E12; data-model.md (Submission, Certificate, CertificateCounter — «Номер сертификата без гонок»); D-004/D-010/D-011/D-016/D-029; seed.md Ф3; phases.md Ф3.

**Правила исполнителям:** «12/12» — ТОЛЬКО через isLessonPassed/getCourseProgress (D-029); номер никогда не переиспользуется (CERT-03); PDF не хранится (D-011); тексты письма/макет — черновики (финал утвердит Иван — phases.md); все строки ru.ts.

---

### Task 1: Номер сертификата (TDD чистой части + транзакция)

**Files:** Create `lib/cert/number.ts`, `lib/cert/number.test.ts`

- [ ] Step 1, failing-тесты:

```ts
import { describe, it, expect } from 'vitest'
import { formatCertNumber, certYearWarsaw } from './number'

describe('cert number', () => {
  it('формат CRAT-{год}-{NNNN} с паддингом (CERT-03)', () => {
    expect(formatCertNumber(2026, 1)).toBe('CRAT-2026-0001')
    expect(formatCertNumber(2026, 1234)).toBe('CRAT-2026-1234')
    expect(formatCertNumber(2027, 12345)).toBe('CRAT-2027-12345') // >9999 не ломается
  })
  it('год по Europe/Warsaw (UX-08): 31 декабря 23:30 UTC = 1 января Warsaw', () => {
    expect(certYearWarsaw(new Date('2026-12-31T23:30:00Z'))).toBe(2027)
    expect(certYearWarsaw(new Date('2026-06-15T12:00:00Z'))).toBe(2026)
  })
})
```

- [ ] Step 2: Red. Step 3: реализация:

```ts
export const formatCertNumber = (year: number, n: number): string =>
  `CRAT-${year}-${String(n).padStart(4, '0')}`

/** Год по Europe/Warsaw (CERT-03, UX-08). */
export const certYearWarsaw = (d: Date = new Date()): number =>
  Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', year: 'numeric' }).format(d))

import { db } from '@/lib/db'
import type { Prisma } from '@/lib/generated/prisma/client'

/** Следующий номер — транзакционно, без гонок и дублей (CERT-03, data-model «без гонок»).
 *  Вызывать ТОЛЬКО внутри interactive transaction (tx). SELECT ... FOR UPDATE через $queryRaw. */
export async function nextCertNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
  const year = certYearWarsaw(now)
  await tx.$executeRaw`INSERT INTO "CertificateCounter" ("year","counter") VALUES (${year},0) ON CONFLICT ("year") DO NOTHING`
  const rows = await tx.$queryRaw<{ counter: number }[]>`SELECT "counter" FROM "CertificateCounter" WHERE "year"=${year} FOR UPDATE`
  const next = rows[0].counter + 1
  await tx.certificateCounter.update({ where: { year }, data: { counter: next } })
  return formatCertNumber(year, next)
}
```
(db-импорт не используется — убрать, tx приходит параметром; проверь итоговые импорты.)

- [ ] Step 4: Green (92→94/95). Step 5: Commit `"Ф3: номер сертификата — формат, Warsaw-год, FOR UPDATE-счётчик (CERT-03)"` (+трейлер Co-Authored-By: Claude Fable 5 <noreply@anthropic.com> — везде далее).

---

### Task 2: PDF сертификата (Playwright, D-011)

**Files:** Create `lib/cert/pdf.ts`, `lib/cert/template.ts`; Modify `package.json` (playwright), `render.yaml` (buildCommand + env), `README.md` (заметка про chromium)

- [ ] Step 1: `npm i playwright` (полный, не -core: нужен установщик браузера).

- [ ] Step 2: `lib/cert/template.ts` — HTML-шаблон (черновик-плейсхолдер до Ф5; тёмный фон, токены зашиты литералами — email/pdf не читают CSS-файлы):

```ts
import { t } from '@/lib/i18n'

export function certificateHtml(opts: { fullName: string; courseTitle: string; number: string; dateStr: string }): string {
  return `<!doctype html><html><body style="margin:0"><div style="width:1123px;height:794px;background:#0E0B0B;color:#F2E9DC;font-family:Georgia,serif;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:60px;box-sizing:border-box">
    <div style="color:#FF4B3A;font-size:28px;letter-spacing:6px">CRAT STUDIO</div>
    <div style="font-size:22px;margin-top:40px;color:#B9A7D6">${t.cert.pdfIssuedTo}</div>
    <div style="font-size:52px;margin:16px 0">${esc(opts.fullName)}</div>
    <div style="font-size:22px;color:#B9A7D6">${t.cert.pdfCompleted}</div>
    <div style="font-size:30px;margin:16px 0;max-width:900px">${esc(opts.courseTitle)}</div>
    <div style="margin-top:48px;font-size:18px;color:#7FD6B4">${opts.dateStr} · ${opts.number}</div>
    <div style="margin-top:8px;font-size:16px;color:#B9A7D6">${t.cert.pdfVerify}: cratstudio.com/cert/${opts.number}</div>
  </div></body></html>`
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
```
Строки ru.ts (раздел cert): pdfIssuedTo 'Сертификат выдан', pdfCompleted 'за прохождение курса', pdfVerify 'Проверить подлинность'.

- [ ] Step 3: `lib/cert/pdf.ts`:

```ts
import { chromium } from 'playwright'
import { certificateHtml } from './template'

/** PDF по требованию (D-011): не хранится, рендерится при письме и каждом скачивании. */
export async function renderCertificatePdf(opts: Parameters<typeof certificateHtml>[0]): Promise<Buffer> {
  const browser = await chromium.launch({ args: ['--no-sandbox'] }) // Render: без sandbox-привилегий
  try {
    const page = await browser.newPage()
    await page.setContent(certificateHtml(opts), { waitUntil: 'load' })
    return await page.pdf({ width: '1123px', height: '794px', printBackground: true, pageRanges: '1' })
  } finally {
    await browser.close()
  }
}
```

- [ ] Step 4: render.yaml — buildCommand: `npm ci --include=dev && npx playwright install chromium && npm run build`; envVars += `{ key: PLAYWRIGHT_BROWSERS_PATH, value: /opt/render/project/src/.playwright }` и install с этим же путём? ВНИМАНИЕ: сверься с актуальной документацией Render/Playwright (web search разрешён): цель — браузер, установленный в build, доступен в runtime (кэш-путь внутри project-директории). Зафиксируй фактическое решение в отчёте и README («Сертификаты: chromium ставится на build, риск первого деплоя — проверить /app/certificate на проде»).

- [ ] Step 5: локальная проверка: `npx playwright install chromium` + временный скрипт (scratchpad) рендерит PDF из фиктивных данных → файл >10KB, начинается с %PDF. Удали скрипт. typecheck/lint/test/build. Commit `"Ф3: PDF сертификата — Playwright-рендер по требованию (CERT-04, D-011)"`.

---

### Task 3: Выдача сертификата (CERT-01/02/03, E12) + письмо (CERT-05, MAIL)

**Files:** Create `lib/cert/index.ts`; Modify `lib/i18n/ru.ts`, `lib/admin/resend-email.ts` (поддержка CERTIFICATE)

- [ ] Step 1: `lib/cert/index.ts`:

```ts
import { db } from '@/lib/db'
import { getCourseProgress } from '@/lib/progress'
import { isLessonPassed } from '@/lib/progress/quiz-logic'
import { lessonCount, getContent } from '@/lib/content'
import { nextCertNumber } from './number'
import { renderCertificatePdf } from './pdf'
import { sendEmail } from '@/lib/email'
import { renderEmail } from '@/lib/email/templates'
import { formatDate } from '@/lib/i18n/format-date'
import { t } from '@/lib/i18n'

const COURSE = 'ai-basics'

/** CERT-01: живое 12/12 (D-029) И текущий Submission APPROVED. */
export async function isEligible(userId: string): Promise<boolean> {
  const [{ byLesson }, current] = await Promise.all([
    getCourseProgress(userId),
    db.submission.findFirst({ where: { userId, courseSlug: COURSE }, orderBy: { attempt: 'desc' } }),
  ])
  const all = getContent().course.modules.flatMap(m => m.lessons.map(l => l.id))
  const passed = all.filter(id => isLessonPassed(byLesson.get(id))).length
  return passed === lessonCount() && current?.status === 'APPROVED'
}

/** Идемпотентная выдача (E12): транзакция «нет VALID → номер FOR UPDATE → insert».
 *  Вызывается на обоих триггерах CERT-01; повторный вызов — no-op. */
export async function checkAndIssueCertificate(userId: string): Promise<'issued' | 'already' | 'not_eligible'> {
  if (!(await isEligible(userId))) return 'not_eligible'
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return 'not_eligible'
  const courseTitle = getContent().course.title

  let issuedNumber: string | null = null
  await db.$transaction(async tx => {
    const existing = await tx.certificate.findFirst({ where: { userId, courseSlug: COURSE, status: 'VALID' } })
    if (existing) return // E12: второй триггер выходит без действия
    const number = await nextCertNumber(tx)
    await tx.certificate.create({
      data: { number, userId, fullName: `${user.firstName} ${user.lastName}`, courseSlug: COURSE, courseTitle },
    })
    issuedNumber = number
  })
  if (!issuedNumber) return 'already'
  await sendCertificateEmail(userId, issuedNumber).catch(e => console.error('[cert] письмо не поставлено в очередь:', e))
  return 'issued'
}

/** CERT-05: письмо с PDF-вложением. Используется выдачей и переотправкой (D-028: payload {}). */
export async function sendCertificateEmail(userId: string, number: string): Promise<void> {
  const cert = await db.certificate.findUnique({ where: { number } })
  if (!cert || cert.status !== 'VALID' || !cert.fullName) throw new Error(`certificate not sendable: ${number}`)
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('user not found')
  const pdf = await renderCertificatePdf({ fullName: cert.fullName, courseTitle: cert.courseTitle, number, dateStr: formatDate(cert.issuedAt) })
  await sendEmail({
    to: user.email, userId, type: 'CERTIFICATE', subject: t.email.certSubject,
    html: renderEmail({ body: t.email.certBody, buttonText: t.email.certButton, buttonUrl: `${process.env.APP_URL}/cert/${number}` }),
    payload: {},
    attachments: [{ filename: `${number}.pdf`, content: pdf }],
  })
}
```
`sendEmail` не принимает attachments — добавь опциональный параметр `attachments?: { filename: string; content: Buffer }[]` в lib/email/index.ts и прокинь в resend.emails.send (Resend принимает content как Buffer/base64 — сверься с типами SDK).

- [ ] Step 2: строки ru.ts (email): certSubject 'Ваш сертификат — CRAT studio', certBody 'Поздравляем! Курс пройден полностью — ваш именной сертификат в приложении к письму. Кнопка ниже — публичная страница подтверждения.', certButton 'Открыть страницу сертификата'.

- [ ] Step 3: `lib/admin/resend-email.ts` — case 'CERTIFICATE': найди VALID-сертификат по `db.certificate.findFirst({ where: { userId: log.userId, status: 'VALID' } })`; если нет (отозван/нет) → 'unsupported_type' не подходит — верни новый результат 'cert_gone' (баннер t.admin.emailCertGone 'Сертификат отозван или не найден — переотправка невозможна'); иначе `await sendCertificateEmail(log.userId!, cert.number)` и 'sent'. Обнови action (redirect ?resend=cert_gone) и страницу писем.

- [ ] Step 4: typecheck/lint/test/build. Commit `"Ф3: выдача сертификата — идемпотентная транзакция, письмо с PDF (CERT-01/03/05, E12)"`.

---

### Task 4: lib/project — сабмишены (PROJ-01…06, D-016; TDD чистой части)

**Files:** Create `lib/project/index.ts`, `lib/project/fields.ts`, `lib/project/fields.test.ts`

- [ ] Step 1: `fields.ts` + TDD — описание 7 полей и нормализация:

```ts
export const PROJECT_FIELDS = ['task', 'tool', 'prompt', 'result', 'refined', 'verified', 'application'] as const
export type ProjectField = (typeof PROJECT_FIELDS)[number]
export type ProjectDraft = Record<ProjectField, string | null>

/** Черновик можно сохранять частично; для ОТПРАВКИ все 7 полей непустые (PROJ-01/03). */
export function normalizeDraft(input: Record<string, unknown>): ProjectDraft { /* trim, ''→null, обрезка 5000 */ }
export function isSubmittable(d: ProjectDraft): boolean { /* все 7 непустые */ }
```
Тесты: trim/пустые→null/обрезка; isSubmittable false при одном null, true при всех.

- [ ] Step 2: `lib/project/index.ts` — Prisma-слой:
- `getCurrentSubmission(userId)` — findFirst orderBy attempt desc;
- `saveDraft(userId, draft)` — текущая DRAFT/NEEDS_CHANGES? По PROJ-02/04: черновик = строка DRAFT; NEEDS_CHANGES открывает НОВУЮ попытку (attempt+1, DRAFT, предзаполнен прошлым) при первом редактировании — реализуй: если текущая NEEDS_CHANGES → создать новую DRAFT (attempt+1, поля из текущей, затем applied draft); если DRAFT → update; если SUBMITTED/APPROVED → отказ 'locked' (PROJ-03: на проверке не редактируем; PROJ-06);
- `submitProject(userId)` — текущая DRAFT и isSubmittable → SUBMITTED + submittedAt; иначе 'incomplete'|'locked';
- P2002-ретрай на attempt-гонку (паттерн startAttempt).

- [ ] Step 3: typecheck/lint/test/build. Commit `"Ф3: lib/project — черновики, отправка, пересдачи (PROJ-01…04,06, D-016)"`.

---

### Task 5: Страница мини-проекта (/app/project)

**Files:** Create `app/app/project/page.tsx`, `app/actions/project.ts`; Modify `app/app/page.tsx` (ссылка/статус в кабинете), `lib/i18n/ru.ts`

- Форма 7 textarea (labels из ru.ts: projTask 'Какую задачу решали', projTool 'Каким инструментом', projPrompt 'Какой запрос дали', projResult 'Что получили', projRefined 'Что уточнили', projVerified 'Как проверили результат', projApplication 'Где будете применять'), кнопки «Сохранить черновик» (saveDraftAction) и «Отправить на проверку» (submitProjectAction, disabled нет — сервер проверит isSubmittable, при 'incomplete' → ?project=incomplete баннер).
- Статусы: SUBMITTED → «Отчёт на проверке» (форма read-only — textarea disabled); NEEDS_CHANGES → комментарий админа (adminComment) видимым блоком + форма редактируемая (saveDraft создаст новую попытку); APPROVED → «Принят!» + форма read-only (PROJ-06); DRAFT/нет → форма.
- Кабинет: блок «Финальный мини-проект» со статусом и ссылкой (после списка уроков): нет попытки → 'не начат'; DRAFT 'черновик'; SUBMITTED 'на проверке'; NEEDS_CHANGES 'нужны правки'; APPROVED 'принят'.
- actions: requireStudent-паттерн (как lesson.ts), redirect на /app/project с ?project=saved|submitted|incomplete|locked.
- Строки статусы/баннеры в ru.ts (project.*). Commit `"Ф3: страница мини-проекта — черновик, отправка, статусы (PROJ-01…06)"`.

---

### Task 6: Проверка в админке (ADM-06/07) + триггер approve

**Files:** Create `app/admin/projects/page.tsx`, `lib/admin/review-project.ts`; Modify `app/actions/admin.ts`, `app/admin/layout.tsx` (nav), `app/admin/students/[userId]/page.tsx` (заменить заглушку project на реальный статус), `lib/i18n/ru.ts`

- [ ] `lib/admin/review-project.ts`:

```ts
export type ReviewResult = 'approved' | 'needs_changes' | 'conflict' | 'not_found' | 'comment_required' | 'not_submitted'

/** ADM-06/07: optimistic concurrency — updatedAt из формы сравнивается атомарным updateMany. */
export async function reviewProject(submissionId: string, verdict: 'approve' | 'needs_changes', comment: string, seenUpdatedAt: string, adminId: string): Promise<ReviewResult> {
  const sub = await db.submission.findUnique({ where: { id: submissionId } })
  if (!sub) return 'not_found'
  if (sub.status !== 'SUBMITTED') return 'not_submitted'
  if (verdict === 'needs_changes' && !comment.trim()) return 'comment_required'
  const updated = await db.submission.updateMany({
    where: { id: submissionId, status: 'SUBMITTED', updatedAt: new Date(seenUpdatedAt) }, // ADM-07
    data: { status: verdict === 'approve' ? 'APPROVED' : 'NEEDS_CHANGES', adminComment: comment.trim() || null, reviewedById: adminId, reviewedAt: new Date() },
  })
  if (updated.count !== 1) return 'conflict'
  if (verdict === 'approve') {
    const { checkAndIssueCertificate } = await import('@/lib/cert') // триггер CERT-01 №2 (PROJ-05)
    await checkAndIssueCertificate(sub.userId).catch(e => console.error('[cert] выдача после approve:', e))
  }
  return verdict === 'approve' ? 'approved' : 'needs_changes'
}
```
ВНИМАНИЕ: сравнение updatedAt с миллисекундами — hidden поле формы = sub.updatedAt.toISOString(); updateMany where updatedAt: exact — Prisma DateTime сравнение точное, ок.

- [ ] `/admin/projects` — список SUBMITTED (старые сверху): студент, дата, 7 полей раскрыты, форма: textarea comment + 2 кнопки (approve / needs_changes) + hidden submissionId/updatedAt → reviewProjectAction → redirect ?review=approved|needs_changes|conflict|comment_required (баннеры; conflict — «данные изменились, обновите страницу» ADM-07). Nav-ссылка t.admin.projects 'Проекты'.
- [ ] student detail: заглушку projectPhase3 заменить реальным статусом текущего сабмишена + сертификат: номер/дата/статус или notYet.
- [ ] Строки ru.ts. Commit `"Ф3: проверка мини-проектов с optimistic concurrency + триггер выдачи (ADM-06/07, PROJ-05)"`.

---

### Task 7: Триггер от урока + кабинет-сертификат + публичная проверка

**Files:** Modify `lib/progress/index.ts` (recomputeCompletion → dynamic import checkAndIssue), `app/app/page.tsx` (блок сертификата); Create `app/cert/[number]/page.tsx`, `app/app/certificate/route.ts` (скачивание PDF)

- [ ] recomputeCompletion: после установки completedAt добавь:

```ts
const { checkAndIssueCertificate } = await import('@/lib/cert') // dynamic: не создаём статический цикл progress↔cert
await checkAndIssueCertificate(userId).catch(e => console.error('[cert] выдача после урока:', e))
```
(CERT-01 триггер №1: последний урок при уже-approved проекте — E7-симметрия.)

- [ ] `app/cert/[number]/page.tsx` — ПУБЛИЧНАЯ (CERT-06): findUnique по number: нет → t.cert.notFound «Сертификат не найден»; REVOKED → t.cert.revoked «Сертификат отозван по запросу владельца» (D-010); VALID → ФИО, курс, дата (formatDate), номер. metadata title. force-dynamic.
- [ ] `app/app/certificate/route.ts` — GET: currentUser + свой VALID-сертификат → renderCertificatePdf → Response с Content-Type application/pdf, Content-Disposition attachment "{number}.pdf"; нет сертификата → 404. (D-011: рендер на каждое скачивание.)
- [ ] Кабинет: если есть VALID-сертификат — блок t.cert.cabinetTitle 'Ваш сертификат' + номер + кнопки «Скачать PDF» (/app/certificate) и «Страница подтверждения» (/cert/{number}).
- [ ] robots.ts: /cert/ НЕ дизаллавить (публичная проверка — SEO-01 её включает); sitemap не трогаем (номера приватность? страница публична, но перечислять номера в sitemap не нужно).
- [ ] Строки ru.ts (cert.*). Commit `"Ф3: триггер урока, кабинет-сертификат, публичная проверка (CERT-01/05/06)"`.

---

### Task 8: seed v3 + финальный прогон

**Files:** Modify `scripts/seed.ts`

- [ ] seedF3 (docs/seed.md Ф3, идемпотентно):
- `diplomant@seed.crat.example`: User + Enrollment + ENROLLED-заявка + согласия (паттерн student@) + ВСЕ 12 уроков пройдены (LessonProgress upsert с датами + по одной зачтённой попытке QuizResult + DeferredQuizState) + Submission attempt 1 SUBMITTED (7 осмысленных полей, submittedAt) — «одна кнопка approve отделяет от сертификата»;
- `student@`: Submission attempt 1 NEEDS_CHANGES с adminComment 'Добавьте, как проверяли результат — шаг 6 пуст.' (reviewedAt);
- magic-ссылка diplomant в stdout.
- [ ] Финальный прогон: typecheck/lint/test/build; seed без БД → catch, exit 1. Commit `"Ф3: seed v3 — дипломант 12/12 + SUBMITTED, needs_changes студенту"`.

---

## Внешние шаги Ивана (закрытие Ф3)
1. Первый деплой с Playwright — проверить, что chromium ставится (лог build) и PDF скачивается на проде; если упадёт — я разберу.
2. Утвердить тексты письма CERTIFICATE и черновик-макет PDF (правится в ru.ts/template.ts).
3. Smoke-чеклист Ф3 из phases.md (5 шагов).

## Self-review
- PROJ-01…06 (T4/T5), ADM-06/07 (T6), CERT-01 оба триггера (T6 approve + T7 урок), CERT-02 (isEligible: current APPROVED обязателен — submitted/needs_changes → false), CERT-03 (T1 FOR UPDATE + E12-транзакция T3), CERT-04 (T2), CERT-05 (T3 письмо + T7 кабинет), CERT-06 (T7), CERT-07 — готов с Ф1 (gdpr.ts). E7: approve при 11/12 → not_eligible; 12-й урок → триггер T7 выдаёт. MAIL: sendEmail+attachments (T3), переотправка CERTIFICATE (T3 Step 3).
- Типы: PROJECT_FIELDS (T4) ↔ форма T5 ↔ admin T6; ProjectDraft; ReviewResult.
- Порядок: T1→T2→T3→T4→T5→T6→T7→T8.
