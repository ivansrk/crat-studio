# Ф1 «Регистрация + magic link + админка» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Полный цикл F1→F2→F3 на проде: главная + лендинг с формой заявки → админ выдаёт доступ → письмо → вход по magic link → каркас кабинета; плюс email_log с ретраями, CSV, GDPR-удаление, отписка и SEO-база.

**Architecture:** Глубокие модули в lib/ (auth/session, auth/magic-link, auth/rate-limit, email, registration, admin/gdpr) — роуты и server actions тонкие (SEC-08). Сессия — stateless HMAC-cookie (D-008), пользователь читается из базы на каждый запрос. Письма — Resend + email_log + in-process ретраи (D-013). Все строки — lib/i18n/ru.ts.

**Tech Stack:** существующий скелет Ф0 (Next 16, Prisma 7 + adapter-pg, vitest) + npm-пакет `resend`. Без новых инфраструктурных сущностей.

**Спеки:** requirements.md §§ SITE, REG, AUTH, ADM (01–04, 08–11), MAIL, SEC; flows.md F1–F3, E1–E4; seed.md Ф1. ADM-05 (прогресс) — Ф2, писем типа CERTIFICATE — Ф3.

**Важно исполнителям:** локальной БД нет (нет Docker) — DB-зависимые флоу проверяются кодом + тестами чистой логики; живой smoke — на Render. Prisma-клиент импортируется ТОЛЬКО из `@/lib/db`. Все enum-значения — из prisma/schema.prisma (ConsentType.DATA_PROCESSING/NEWSLETTER, ConsentSource.REGISTRATION_FORM/ADMIN/UNSUBSCRIBE_LINK, RegistrationStatus.NEW/RESUBMITTED/ENROLLED, EmailType.MAGIC_LINK/ACCESS_GRANTED, EmailStatus.QUEUED/SENT/FAILED, Role.ADMIN).

---

### Task 1: Сессия — подписанная cookie (D-008, AUTH-07)

**Files:**
- Create: `lib/auth/session.ts`, `lib/auth/session.test.ts`, `lib/auth/current-user.ts`

- [ ] **Step 1: Failing-тест `lib/auth/session.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { signSession, verifySession, SESSION_TTL_MS } from './session'

const SECRET = 'test-secret'

describe('session cookie', () => {
  it('подписывает и верифицирует userId', () => {
    const v = signSession('user-1', SECRET)
    expect(verifySession(v, SECRET)).toBe('user-1')
  })
  it('отклоняет подделку payload и подписи', () => {
    const v = signSession('user-1', SECRET)
    const [p, sig] = v.split('.')
    const forged = Buffer.from(JSON.stringify({ uid: 'user-2', exp: Date.now() + 1e6 })).toString('base64url')
    expect(verifySession(`${forged}.${sig}`, SECRET)).toBeNull()
    expect(verifySession(`${p}.AAAA`, SECRET)).toBeNull()
    expect(verifySession('мусор', SECRET)).toBeNull()
  })
  it('отклоняет истёкшую сессию', () => {
    const past = signSession('user-1', SECRET, Date.now() - SESSION_TTL_MS - 1000)
    expect(verifySession(past, SECRET)).toBeNull()
  })
  it('другой секрет — невалидно', () => {
    expect(verifySession(signSession('u', 'a'), 'b')).toBeNull()
  })
})
```

- [ ] **Step 2: Red** — `npm test` → FAIL `Cannot find module './session'`.

- [ ] **Step 3: `lib/auth/session.ts`**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 дней (AUTH-07)
export const SESSION_COOKIE = 'crat_session'

const hmac = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest('base64url')

/** Stateless-сессия (D-008): base64url(JSON{uid,exp}) + '.' + HMAC-SHA256. */
export function signSession(userId: string, secret: string, issuedAt = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: issuedAt + SESSION_TTL_MS })).toString('base64url')
  return `${payload}.${hmac(payload, secret)}`
}

export function verifySession(value: string | undefined, secret: string, now = Date.now()): string | null {
  if (!value) return null
  const dot = value.lastIndexOf('.')
  if (dot < 1) return null
  const payload = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  const expected = hmac(payload, secret)
  const a = Buffer.from(sig), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (typeof uid !== 'string' || typeof exp !== 'number' || exp < now) return null
    return uid
  } catch { return null }
}
```

- [ ] **Step 4: Green** — `npm test` PASS.

- [ ] **Step 5: `lib/auth/current-user.ts`** (пользователь из базы на каждый запрос — D-008; роль админа по env на каждый запрос — AUTH-10):

```ts
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifySession, SESSION_COOKIE } from './session'
import { parseAdminEmails } from './parse-admin-emails'
import type { User } from '@/lib/generated/prisma/client'

export async function currentUser(): Promise<User | null> {
  const jar = await cookies()
  const uid = verifySession(jar.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET ?? '')
  if (!uid) return null
  return db.user.findUnique({ where: { id: uid } })
}

/** Админ = email в ADMIN_EMAILS, проверяется по env на КАЖДЫЙ запрос (AUTH-10), не по полю role. */
export function isAdminEmail(email: string): boolean {
  return parseAdminEmails(process.env.ADMIN_EMAILS).includes(email.toLowerCase())
}
```
(Если импорт типа User из generated-клиента не резолвится в typecheck без generate — CI делает generate до typecheck, ок; локально `npx prisma generate`.)

- [ ] **Step 6: Commit** `git add lib/auth && git commit -m "Ф1: stateless-сессия HMAC-cookie + currentUser (D-008, AUTH-07, AUTH-10)"` (+трейлер Co-Authored-By: Claude Fable 5 <noreply@anthropic.com> — далее во всех коммитах).

---

### Task 2: Rate limiter в памяти (SEC-03, D-015)

**Files:**
- Create: `lib/auth/rate-limit.ts`, `lib/auth/rate-limit.test.ts`

- [ ] **Step 1: Failing-тест**

```ts
import { describe, it, expect } from 'vitest'
import { RateLimiter } from './rate-limit'

describe('RateLimiter', () => {
  it('пускает limit попыток в окне и режет следующую', () => {
    const rl = new RateLimiter(3, 60_000)
    const t = 1_000_000
    expect(rl.allow('k', t)).toBe(true)
    expect(rl.allow('k', t + 1)).toBe(true)
    expect(rl.allow('k', t + 2)).toBe(true)
    expect(rl.allow('k', t + 3)).toBe(false)
  })
  it('окно скользит: старые попытки истекают', () => {
    const rl = new RateLimiter(1, 1000)
    expect(rl.allow('k', 0)).toBe(true)
    expect(rl.allow('k', 500)).toBe(false)
    expect(rl.allow('k', 1001)).toBe(true)
  })
  it('ключи независимы', () => {
    const rl = new RateLimiter(1, 1000)
    expect(rl.allow('a', 0)).toBe(true)
    expect(rl.allow('b', 0)).toBe(true)
  })
  it('память ограничена (LRU-подрезка)', () => {
    const rl = new RateLimiter(1, 1000, 100)
    for (let i = 0; i < 200; i++) rl.allow(`k${i}`, i)
    expect(rl.size).toBeLessThanOrEqual(100)
  })
})
```

- [ ] **Step 2: Red.** **Step 3: `lib/auth/rate-limit.ts`**

```ts
/** In-memory скользящее окно (D-015): рестарт сбрасывает счётчики — приемлемо для anti-abuse. */
export class RateLimiter {
  private hits = new Map<string, number[]>()
  constructor(private limit: number, private windowMs: number, private maxKeys = 10_000) {}

  allow(key: string, now = Date.now()): boolean {
    const list = (this.hits.get(key) ?? []).filter(ts => now - ts < this.windowMs)
    if (list.length >= this.limit) { this.hits.set(key, list); return false }
    list.push(now)
    this.hits.delete(key) // переставляем в конец Map — дешёвый LRU
    this.hits.set(key, list)
    if (this.hits.size > this.maxKeys) this.hits.delete(this.hits.keys().next().value!)
    return true
  }
  get size() { return this.hits.size }
}

// Синглтоны на процесс (globalThis — переживают HMR):
const g = globalThis as unknown as { __rl?: Record<string, RateLimiter> }
g.__rl ??= {
  registration: new RateLimiter(5, 60 * 60 * 1000), // REG-07: 5/час/IP
  magicLink: new RateLimiter(3, 15 * 60 * 1000),    // AUTH-08: 3/15мин/email
}
export const limiters = g.__rl
```

- [ ] **Step 4: Green.** **Step 5: Commit** `"Ф1: in-memory rate limiter (REG-07, AUTH-08, D-015)"`.

---

### Task 3: Токен отписки (MAIL-06) — без таблицы

**Files:**
- Create: `lib/email/unsubscribe-token.ts`, `lib/email/unsubscribe-token.test.ts`

- [ ] **Step 1: Failing-тест**

```ts
import { describe, it, expect } from 'vitest'
import { makeUnsubToken, readUnsubToken } from './unsubscribe-token'

describe('unsubscribe token', () => {
  it('кодирует и читает email', () => {
    expect(readUnsubToken(makeUnsubToken('a@b.c', 's'), 's')).toBe('a@b.c')
  })
  it('подделка/чужой секрет → null', () => {
    const t = makeUnsubToken('a@b.c', 's')
    expect(readUnsubToken(t, 'other')).toBeNull()
    expect(readUnsubToken('xx.yy', 's')).toBeNull()
  })
})
```

- [ ] **Step 2: Red.** **Step 3: Реализация** (тот же паттерн, что session):

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

const sig = (d: string, s: string) => createHmac('sha256', s).update(`unsub:${d}`).digest('base64url')

/** Токен отписки: base64url(email).hmac — таблица не нужна, email восстановим из токена. */
export function makeUnsubToken(email: string, secret: string): string {
  const p = Buffer.from(email.trim().toLowerCase()).toString('base64url')
  return `${p}.${sig(p, secret)}`
}
export function readUnsubToken(token: string, secret: string): string | null {
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  const p = token.slice(0, dot), s = token.slice(dot + 1)
  const e = sig(p, secret)
  const a = Buffer.from(s), b = Buffer.from(e)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try { return Buffer.from(p, 'base64url').toString() } catch { return null }
}
```

- [ ] **Step 4: Green.** **Step 5: Commit** `"Ф1: HMAC-токен отписки без таблицы (MAIL-06)"`.

---

### Task 4: Модуль писем — Resend, email_log, ретраи (MAIL-01, 03–05, D-013)

**Files:**
- Create: `lib/email/templates.ts`, `lib/email/index.ts`, `lib/email/index.test.ts`
- Modify: `lib/i18n/ru.ts` (тексты писем), `package.json` (`npm i resend`)

- [ ] **Step 1: `npm i resend`**

- [ ] **Step 2: Строки писем в `lib/i18n/ru.ts`** (добавить раздел):

```ts
email: {
  magicLinkSubject: 'Ваша ссылка для входа — CRAT studio',
  magicLinkBody: 'Здравствуйте! Нажмите кнопку, чтобы войти. Ссылка действует 15 минут и работает один раз.',
  magicLinkButton: 'Войти в кабинет',
  accessSubject: 'Доступ к курсу открыт — CRAT studio',
  accessBody: 'Вам открыт доступ к курсу «Искусственный интеллект в профессиональной и личной деятельности». Войдите по кнопке ниже — пароль не нужен.',
  footer: 'CRAT studio',
  unsubscribe: 'Отписаться от рассылки',
},
```

- [ ] **Step 3: `lib/email/templates.ts`** — простой тёмный HTML на инлайн-стилях (email-клиенты не грузят внешний CSS):

```ts
import { t } from '@/lib/i18n'

export function renderEmail(opts: { body: string; buttonText?: string; buttonUrl?: string; unsubscribeUrl?: string }): string {
  const btn = opts.buttonUrl
    ? `<p style="margin:28px 0"><a href="${opts.buttonUrl}" style="background:#FF4B3A;color:#F2E9DC;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:18px">${opts.buttonText}</a></p>`
    : ''
  const unsub = opts.unsubscribeUrl
    ? `<p style="font-size:14px"><a href="${opts.unsubscribeUrl}" style="color:#B9A7D6">${t.email.unsubscribe}</a></p>`
    : ''
  return `<div style="background:#0E0B0B;color:#F2E9DC;padding:32px;font-family:Arial,sans-serif;font-size:18px;line-height:1.6">
    <p>${opts.body}</p>${btn}<p style="color:#B9A7D6;font-size:16px">${t.email.footer}</p>${unsub}</div>`
}
```
(Транзакционные письма БЕЗ ссылки отписки — MAIL-07; unsubscribeUrl появится у маркетинговых в будущих фазах.)

- [ ] **Step 4: Failing-тест `lib/email/index.test.ts`** (транспорт инжектируется — Resend в тестах не нужен):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deliverWithRetries, RETRY_DELAYS_MS } from './index'

describe('deliverWithRetries', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('успех с первой попытки', async () => {
    const send = vi.fn().mockResolvedValue({ id: 'r1' })
    const events: string[] = []
    await deliverWithRetries(send, m => { events.push(m.status) })
    expect(send).toHaveBeenCalledTimes(1)
    expect(events).toEqual(['SENT'])
  })

  it('3 ретрая с бэкоффом 1/5/15 мин, затем FAILED (MAIL-04, D-013)', async () => {
    const send = vi.fn().mockRejectedValue(new Error('smtp down'))
    const events: string[] = []
    const done = deliverWithRetries(send, m => { events.push(`${m.status}:${m.attempts}`) })
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0])
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1])
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[2])
    await done
    expect(send).toHaveBeenCalledTimes(4) // 1 попытка + 3 ретрая
    expect(events.at(-1)).toBe('FAILED:4')
  })

  it('успех на втором ретрае', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('x')).mockRejectedValueOnce(new Error('x')).mockResolvedValue({ id: 'ok' })
    const events: string[] = []
    const done = deliverWithRetries(send, m => { events.push(m.status) })
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] + RETRY_DELAYS_MS[1])
    await done
    expect(events.at(-1)).toBe('SENT')
  })
})
```

- [ ] **Step 5: Red.** **Step 6: `lib/email/index.ts`**

```ts
import { Resend } from 'resend'
import { db } from '@/lib/db'
import type { EmailType, Prisma } from '@/lib/generated/prisma/client'

export const RETRY_DELAYS_MS = [60_000, 300_000, 900_000] // 1/5/15 мин (D-013)
export const FROM = 'CRAT studio <hello@cratstudio.com>'

type SendFn = () => Promise<{ id?: string }>
type Progress = { status: 'SENT' | 'FAILED'; attempts: number; resendId?: string; lastError?: string }

/** Ядро ретраев — чистое, транспорт инжектируется (тестируемо без Resend). */
export async function deliverWithRetries(send: SendFn, onFinal: (p: Progress) => void): Promise<void> {
  let attempts = 0
  let lastError = ''
  for (;;) {
    attempts++
    try {
      const r = await send()
      onFinal({ status: 'SENT', attempts, resendId: r.id })
      return
    } catch (e) {
      lastError = (e as Error).message
      const delay = RETRY_DELAYS_MS[attempts - 1]
      if (delay === undefined) { onFinal({ status: 'FAILED', attempts, lastError }); return }
      await new Promise(res => setTimeout(res, delay))
    }
  }
}

/** Отправка с логом (MAIL-03): создаёт EmailLog QUEUED, шлёт c ретраями в фоне процесса.
 *  Потерянные при рестарте ретраи остаются QUEUED/FAILED и видны в админке (D-013). */
export async function sendEmail(opts: {
  to: string; userId?: string | null; type: EmailType; subject: string; html: string
  payload: Prisma.InputJsonValue // данные для ручной переотправки (ADM-08)
}): Promise<string> {
  const log = await db.emailLog.create({
    data: { toEmail: opts.to, userId: opts.userId ?? null, type: opts.type, subject: opts.subject, payload: opts.payload },
  })
  const resend = new Resend(process.env.RESEND_API_KEY)
  const send: SendFn = async () => {
    const { data, error } = await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html })
    if (error) throw new Error(error.message)
    return { id: data?.id }
  }
  // fire-and-forget: HTTP-ответ пользователю не ждёт ретраев
  void deliverWithRetries(send, async p => {
    await db.emailLog.update({
      where: { id: log.id },
      data: { status: p.status, attempts: p.attempts, resendId: p.resendId ?? null, lastError: p.lastError ?? null, sentAt: p.status === 'SENT' ? new Date() : null },
    }).catch(err => console.error('[email] не смог обновить лог:', err))
  })
  return log.id
}
```
Замечание: `attempts` в БД пишется один раз финальным значением — достаточно для админки Ф1 (видно FAILED и сколько попыток было); прогресс-апдейты между ретраями — YAGNI.

- [ ] **Step 7: Green** (тесты deliverWithRetries не трогают БД). `npm run typecheck`.

- [ ] **Step 8: Commit** `"Ф1: модуль писем — Resend, email_log, ретраи 1/5/15 мин (MAIL-01,03,04, D-013)"`.

---

### Task 5: Согласия — append-only журнал (D-014)

**Files:**
- Create: `lib/registration/consents.ts`, `lib/registration/consents.test.ts`

- [ ] **Step 1: Failing-тест** (чистая логика «действующее согласие = последняя запись»):

```ts
import { describe, it, expect } from 'vitest'
import { latestConsentByEmail } from './consents'

const row = (email: string, granted: boolean, at: number) =>
  ({ email, granted, createdAt: new Date(at) })

describe('latestConsentByEmail', () => {
  it('действующее = последняя запись по email', () => {
    const m = latestConsentByEmail([row('a@b.c', true, 1), row('a@b.c', false, 2)])
    expect(m.get('a@b.c')).toBe(false)
  })
  it('несколько email независимы', () => {
    const m = latestConsentByEmail([row('a@b.c', true, 5), row('x@y.z', false, 1), row('x@y.z', true, 2)])
    expect(m.get('a@b.c')).toBe(true)
    expect(m.get('x@y.z')).toBe(true)
  })
})
```

- [ ] **Step 2: Red.** **Step 3: `lib/registration/consents.ts`**

```ts
import { db } from '@/lib/db'
import type { ConsentSource, ConsentType } from '@/lib/generated/prisma/client'

/** Append-only (D-014): отписка/повтор = новая строка, история не переписывается. */
export async function appendConsent(opts: {
  email: string; type: ConsentType; granted: boolean; source: ConsentSource; userId?: string | null
}) {
  await db.consent.create({ data: { ...opts, email: opts.email.trim().toLowerCase() } })
}

/** Чистая свёртка «действующее согласие = последняя запись» — используется CSV-экспортом (ADM-09). */
export function latestConsentByEmail(rows: { email: string; granted: boolean; createdAt: Date }[]): Map<string, boolean> {
  const m = new Map<string, boolean>()
  for (const r of [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) m.set(r.email, r.granted)
  return m
}
```

- [ ] **Step 4: Green.** **Step 5: Commit** `"Ф1: журнал согласий append-only (D-014)"`.

---

### Task 6: Регистрация — lib + server action (REG-01…09)

**Files:**
- Create: `lib/registration/index.ts`, `lib/registration/index.test.ts`, `app/actions/register.ts`

- [ ] **Step 1: Failing-тест чистой части** — нормализация и решение о статусе:

```ts
import { describe, it, expect } from 'vitest'
import { normalizeRegistration } from './index'

describe('normalizeRegistration', () => {
  it('trim+lowercase email (REG-08), trim полей', () => {
    const r = normalizeRegistration({ firstName: ' Иван ', lastName: 'С', email: ' A@B.C ', phone: '', telegram: ' @iv ', dataConsent: true, newsletterConsent: false })
    expect(r).toEqual({ firstName: 'Иван', lastName: 'С', email: 'a@b.c', phone: null, telegram: '@iv', dataConsent: true, newsletterConsent: false })
  })
  it('без обязательных полей или без согласия на ПД → null (REG-06)', () => {
    expect(normalizeRegistration({ firstName: '', lastName: 'x', email: 'a@b.c', phone: null, telegram: null, dataConsent: true, newsletterConsent: false })).toBeNull()
    expect(normalizeRegistration({ firstName: 'a', lastName: 'x', email: 'нет-собаки', phone: null, telegram: null, dataConsent: true, newsletterConsent: false })).toBeNull()
    expect(normalizeRegistration({ firstName: 'a', lastName: 'x', email: 'a@b.c', phone: null, telegram: null, dataConsent: false, newsletterConsent: true })).toBeNull()
  })
})
```

- [ ] **Step 2: Red.** **Step 3: `lib/registration/index.ts`**

```ts
import { db } from '@/lib/db'
import { appendConsent } from './consents'

export type RegistrationInput = {
  firstName: string; lastName: string; email: string
  phone: string | null; telegram: string | null
  dataConsent: boolean; newsletterConsent: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Возвращает нормализованные данные или null, если форма невалидна (REG-02, REG-06, REG-08). */
export function normalizeRegistration(i: RegistrationInput): RegistrationInput | null {
  const email = i.email?.trim().toLowerCase() ?? ''
  const firstName = i.firstName?.trim() ?? ''
  const lastName = i.lastName?.trim() ?? ''
  if (!firstName || !lastName || !EMAIL_RE.test(email) || !i.dataConsent) return null
  const opt = (v: string | null) => (v?.trim() ? v.trim() : null)
  return { firstName, lastName, email, phone: opt(i.phone), telegram: opt(i.telegram), dataConsent: true, newsletterConsent: !!i.newsletterConsent }
}

/** F1: создаёт/обновляет заявку + пишет согласия. Возвращает 'accepted' всегда (экран один и тот же). */
export async function submitRegistration(input: RegistrationInput): Promise<'accepted' | 'invalid'> {
  const data = normalizeRegistration(input)
  if (!data) return 'invalid'
  const { email, firstName, lastName, phone, telegram } = data

  const existingUser = await db.user.findUnique({ where: { email } })          // REG-09
  const existing = await db.registration.findUnique({ where: { email } })
  if (existing) {
    await db.registration.update({                                            // REG-05: не дубль, а update
      where: { email },
      data: { firstName, lastName, phone, telegram, submitCount: { increment: 1 }, alreadyEnrolled: !!existingUser,
              status: existing.status === 'ENROLLED' ? 'ENROLLED' : 'RESUBMITTED' },
    })
  } else {
    await db.registration.create({ data: { email, firstName, lastName, phone, telegram, alreadyEnrolled: !!existingUser } })
  }
  await appendConsent({ email, type: 'DATA_PROCESSING', granted: true, source: 'REGISTRATION_FORM', userId: existingUser?.id })
  await appendConsent({ email, type: 'NEWSLETTER', granted: data.newsletterConsent, source: 'REGISTRATION_FORM', userId: existingUser?.id })
  return 'accepted'
}
```
Нюанс REG-05+ENROLLED: если заявка уже ENROLLED, статус не понижаем до RESUBMITTED — заявка остаётся ENROLLED, пометка alreadyEnrolled делает своё (REG-09; админ видит submitCount).

- [ ] **Step 4: Green.** **Step 5: `app/actions/register.ts`** (тонкий server action: rate limit + вызов lib):

```ts
'use server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { limiters } from '@/lib/auth/rate-limit'
import { submitRegistration } from '@/lib/registration'

export async function registerAction(formData: FormData) {
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? 'local').split(',')[0].trim()
  if (!limiters.registration.allow(`reg:${ip}`)) redirect('/ai-basics?signup=rate')   // REG-07, мягко
  const result = await submitRegistration({
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: (formData.get('phone') as string) || null,
    telegram: (formData.get('telegram') as string) || null,
    dataConsent: formData.get('dataConsent') === 'on',
    newsletterConsent: formData.get('newsletterConsent') === 'on',
  })
  redirect(result === 'accepted' ? '/ai-basics/accepted' : '/ai-basics?signup=invalid#signup')
}
```

- [ ] **Step 6: typecheck + lint + test. Commit** `"Ф1: регистрация — заявки, повторы, согласия (REG-01…09)"`.

---

### Task 7: Главная и лендинг курса (SITE-01…06)

**Files:**
- Modify: `app/page.tsx` (главная студии вместо списка уроков), `lib/i18n/ru.ts` (тексты-черновики)
- Create: `app/ai-basics/page.tsx`, `app/ai-basics/accepted/page.tsx`, `components/signup-form.tsx`, `components/site.css` (@import в globals.css)

- [ ] **Step 1: Тексты-черновики в `lib/i18n/ru.ts`** (SITE-05: финальные пришлёт Иван; разделы `home` и `landing`):

```ts
home: {
  heroTitle: 'CRAT studio',
  heroSubtitle: 'Учим взрослых людей уверенно пользоваться искусственным интеллектом — без техножаргона и «это же просто».',
  coursesTitle: 'Наши курсы',
  courseCta: 'Узнать о курсе',
  toCabinet: 'В кабинет',
},
landing: {
  forWhomTitle: 'Для кого этот курс',
  forWhom: 'Для взрослых без технической подготовки: вы научитесь применять нейросети в работе и жизни — письма, таблицы, изображения, планирование, безопасность.',
  programTitle: 'Программа курса',
  resultTitle: 'Что будет в конце',
  result: '12 уроков, финальный мини-проект на вашей реальной задаче и именной сертификат CRAT studio.',
  signupTitle: 'Оставить заявку',
  signupNote: 'Доступ выдаёт администратор — мы напишем вам на почту.',
  firstName: 'Имя', lastName: 'Фамилия', email: 'Почта', phone: 'Телефон (не обязательно)', telegram: 'Telegram (не обязательно)',
  dataConsent: 'Согласен на обработку персональных данных (обязательно)',
  newsletterConsent: 'Хочу получать письма о новых курсах (по желанию)',
  submit: 'Отправить заявку',
  acceptedTitle: 'Заявка принята',
  acceptedBody: 'Спасибо! Доступ выдаст администратор — письмо со входом придёт на вашу почту.',
  invalid: 'Проверьте: имя, фамилия, почта и согласие на обработку данных обязательны.',
  rate: 'Слишком много попыток, попробуйте позже.',
},
```

- [ ] **Step 2: `components/signup-form.tsx`** (серверный компонент, обычная HTML-форма — работает без JS; ошибки через searchParams):

```tsx
import { registerAction } from '@/app/actions/register'
import { t } from '@/lib/i18n'

export function SignupForm({ notice }: { notice?: 'invalid' | 'rate' }) {
  return (
    <form id="signup" action={registerAction} className="signup-form">
      <h2>{t.landing.signupTitle}</h2>
      <p>{t.landing.signupNote}</p>
      {notice && <p role="alert" className="form-alert">{notice === 'rate' ? t.landing.rate : t.landing.invalid}</p>}
      <label>{t.landing.firstName}<input name="firstName" required autoComplete="given-name" /></label>
      <label>{t.landing.lastName}<input name="lastName" required autoComplete="family-name" /></label>
      <label>{t.landing.email}<input name="email" type="email" required autoComplete="email" /></label>
      <label>{t.landing.phone}<input name="phone" autoComplete="tel" /></label>
      <label>{t.landing.telegram}<input name="telegram" /></label>
      <label className="check"><input type="checkbox" name="dataConsent" required /> {t.landing.dataConsent}</label>
      <label className="check"><input type="checkbox" name="newsletterConsent" /> {t.landing.newsletterConsent}</label>
      <button type="submit" className="mdx-download">{t.landing.submit}</button>
    </form>
  )
}
```
(Чекбоксы непредотмечены — REG-03; dataConsent с required на клиенте И проверкой на сервере — REG-06.)

- [ ] **Step 3: `app/ai-basics/page.tsx`** — лендинг: для кого → программа из course.yaml (SITE-02, не руками) → результат → форма; SITE-04 «В кабинет» при сессии:

```tsx
import Link from 'next/link'
import { getContent } from '@/lib/content'
import { currentUser } from '@/lib/auth/current-user'
import { SignupForm } from '@/components/signup-form'
import { t } from '@/lib/i18n'

export default async function Landing({ searchParams }: { searchParams: Promise<{ signup?: string }> }) {
  const { signup } = await searchParams
  const user = await currentUser()
  const { course } = getContent()
  return (
    <main>
      <h1>{course.title}</h1>
      <p>{t.landing.forWhom}</p>
      {user
        ? <p><Link className="mdx-download" href="/app">{t.home.toCabinet}</Link></p>
        : <p><a className="mdx-download" href="#signup">{t.landing.signupTitle}</a></p>}
      <h2>{t.landing.programTitle}</h2>
      {course.modules.map(m => (
        <section key={m.id}><h3>{m.title}</h3>
          <ul>{m.lessons.map(l => <li key={l.id}>{l.title}</li>)}</ul></section>
      ))}
      <h2>{t.landing.resultTitle}</h2>
      <p>{t.landing.result}</p>
      {!user && <SignupForm notice={signup === 'invalid' ? 'invalid' : signup === 'rate' ? 'rate' : undefined} />}
    </main>
  )
}
```

- [ ] **Step 4: `app/ai-basics/accepted/page.tsx`** — «Заявка принята» (t.landing.acceptedTitle/acceptedBody, ссылка на главную). `app/page.tsx` — главная студии (SITE-01): hero (t.home.*), блок «Наши курсы» с карточкой курса из getContent() и ссылкой на /ai-basics; при сессии — кнопка «В кабинет» (SITE-04). Прежний список уроков с главной убрать (уроки теперь доступны из будущего кабинета; прямые URL работают).

```tsx
import Link from 'next/link'
import { getContent } from '@/lib/content'
import { currentUser } from '@/lib/auth/current-user'
import { t } from '@/lib/i18n'

export default async function Home() {
  const user = await currentUser()
  const { course } = getContent()
  return (
    <main>
      <h1 className="anim-neon-pulse">{t.home.heroTitle}</h1>
      <p>{t.home.heroSubtitle}</p>
      {user && <p><Link className="mdx-download" href="/app">{t.home.toCabinet}</Link></p>}
      <h2>{t.home.coursesTitle}</h2>
      <section>
        <h3>{course.title}</h3>
        <p><Link className="mdx-download" href="/ai-basics">{t.home.courseCta}</Link></p>
      </section>
    </main>
  )
}
```

- [ ] **Step 5: `components/site.css`** (+ `@import '../components/site.css';` в globals.css):

```css
.signup-form { display: grid; gap: 1rem; margin-top: 2rem; }
.signup-form label { display: grid; gap: .35rem; }
.signup-form label.check { grid-template-columns: auto 1fr; align-items: start; gap: .6rem; }
.signup-form input:not([type=checkbox]) { background: var(--ink); color: var(--paper); border: 1px solid color-mix(in srgb, var(--paper) 25%, transparent); border-radius: 8px; padding: .8rem 1rem; font-size: var(--fs-base); }
.signup-form input[type=checkbox] { width: 1.3rem; height: 1.3rem; margin-top: .25rem; }
.form-alert { color: var(--neon); }
```

- [ ] **Step 6: typecheck/lint/test/build + ручной smoke** (dev-сервер: главная, лендинг, якорь #signup, отправка формы упадёт на БД — ожидаемо без Postgres; проверь редирект-ветку invalid без БД: пустая форма → ?signup=invalid). **Commit** `"Ф1: главная студии и лендинг курса с формой (SITE-01…06)"`.

---

### Task 8: Magic link — выпуск, вход, страницы (AUTH-01…11)

**Files:**
- Create: `lib/auth/magic-link.ts`, `lib/auth/magic-link.test.ts`, `app/login/page.tsx`, `app/actions/request-link.ts`, `app/auth/[token]/route.ts`, `app/login/sent/page.tsx`, `app/login/invalid/page.tsx`, `app/app/page.tsx` (каркас кабинета), `app/app/layout.tsx` (гейт), `app/actions/logout.ts`
- Modify: `lib/i18n/ru.ts`

- [ ] **Step 1: Failing-тест хэширования** `lib/auth/magic-link.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { newToken, hashToken, MAGIC_TTL_MS } from './magic-link'

describe('magic link token', () => {
  it('токен 64 hex-символа, хэш детерминирован и не равен токену (D-009)', () => {
    const t1 = newToken()
    expect(t1).toMatch(/^[0-9a-f]{64}$/)
    expect(newToken()).not.toBe(t1)
    expect(hashToken(t1)).toBe(hashToken(t1))
    expect(hashToken(t1)).not.toBe(t1)
  })
  it('TTL = 15 минут (AUTH-03)', () => {
    expect(MAGIC_TTL_MS).toBe(15 * 60 * 1000)
  })
})
```

- [ ] **Step 2: Red.** **Step 3: `lib/auth/magic-link.ts`**

```ts
import { createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { limiters } from './rate-limit'
import { isAdminEmail } from './current-user'
import { sendEmail } from '@/lib/email'
import { renderEmail } from '@/lib/email/templates'
import { t } from '@/lib/i18n'

export const MAGIC_TTL_MS = 15 * 60 * 1000 // AUTH-03
export const newToken = () => randomBytes(32).toString('hex')
export const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex') // D-009

/** AUTH-02: наружу ВСЕГДА один ответ; письмо уходит только существующему пользователю. */
export async function requestMagicLink(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase()
  if (!email || !limiters.magicLink.allow(`ml:${email}`)) return // AUTH-08: молча (ответ одинаковый)
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return                                              // SEC-06: не раскрываем
  const raw = newToken()
  await db.magicLink.create({ data: { tokenHash: hashToken(raw), email, userId: user.id, expiresAt: new Date(Date.now() + MAGIC_TTL_MS) } })
  const url = `${process.env.APP_URL}/auth/${raw}`
  await sendEmail({
    to: email, userId: user.id, type: 'MAGIC_LINK', subject: t.email.magicLinkSubject,
    html: renderEmail({ body: t.email.magicLinkBody, buttonText: t.email.magicLinkButton, buttonUrl: url }),
    payload: { url }, // для ручной переотправки; ссылка та же, пока жива (ADM-08)
  })
}

export type ConsumeResult = { ok: true; userId: string; isAdmin: boolean } | { ok: false; reason: 'used' | 'expired' | 'unknown' }

/** AUTH-04: строго одноразово — атомарный updateMany WHERE usedAt IS NULL. */
export async function consumeMagicLink(raw: string): Promise<ConsumeResult> {
  const tokenHash = hashToken(raw)
  const link = await db.magicLink.findUnique({ where: { tokenHash } })
  if (!link) return { ok: false, reason: 'unknown' }
  if (link.usedAt) return { ok: false, reason: 'used' }            // AUTH-05
  if (link.expiresAt < new Date()) return { ok: false, reason: 'expired' } // AUTH-06
  const claimed = await db.magicLink.updateMany({ where: { tokenHash, usedAt: null }, data: { usedAt: new Date() } })
  if (claimed.count !== 1) return { ok: false, reason: 'used' }    // гонка двух кликов
  const user = await db.user.findUnique({ where: { email: link.email } })
  if (!user) return { ok: false, reason: 'unknown' }               // GDPR-удалён между выпиской и кликом
  return { ok: true, userId: user.id, isAdmin: isAdminEmail(user.email) }
}
```

- [ ] **Step 4: Green.** **Step 5: страницы и роуты** (строки — добавить в ru.ts раздел `auth`: title 'Вход', emailLabel 'Почта', submit 'Получить ссылку для входа', sentTitle 'Проверьте почту', sentBody 'Если у вас есть доступ, письмо отправлено. Ссылка живёт 15 минут.', usedTitle 'Ссылка уже использована', expiredTitle 'Ссылка устарела', invalidBody 'Запросите новую ссылку — это одна кнопка.', requestAgain 'Запросить новую ссылку', logout 'Выйти', cabinetTitle 'Кабинет', cabinetStub 'Уроки появятся здесь в следующем обновлении — платформа уже работает.'):

`app/actions/request-link.ts`:
```ts
'use server'
import { redirect } from 'next/navigation'
import { requestMagicLink } from '@/lib/auth/magic-link'

export async function requestLinkAction(formData: FormData) {
  await requestMagicLink(String(formData.get('email') ?? ''))
  redirect('/login/sent') // AUTH-02: ответ всегда одинаковый
}
```

`app/login/page.tsx`:
```tsx
import { requestLinkAction } from '@/app/actions/request-link'
import { t } from '@/lib/i18n'

export default function Login() {
  return (
    <main>
      <h1>{t.auth.title}</h1>
      <form action={requestLinkAction} className="signup-form">
        <label>{t.auth.emailLabel}<input name="email" type="email" required autoComplete="email" /></label>
        <button type="submit" className="mdx-download">{t.auth.submit}</button>
      </form>
    </main>
  )
}
```

`app/login/sent/page.tsx` и `app/login/invalid/page.tsx` — простые main с заголовком/текстом; invalid читает `searchParams` `reason` (used|expired) и показывает t.auth.usedTitle/expiredTitle + t.auth.invalidBody + ссылку-кнопку на /login (AUTH-05/06):
```tsx
import Link from 'next/link'
import { t } from '@/lib/i18n'

export default async function Invalid({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams
  return (
    <main>
      <h1>{reason === 'expired' ? t.auth.expiredTitle : t.auth.usedTitle}</h1>
      <p>{t.auth.invalidBody}</p>
      <p><Link className="mdx-download" href="/login">{t.auth.requestAgain}</Link></p>
    </main>
  )
}
```

`app/auth/[token]/route.ts` (клик по ссылке из письма — GET по природе magic link, AUTH-04):
```ts
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { consumeMagicLink } from '@/lib/auth/magic-link'
import { signSession, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/auth/session'
import { sessionSecret } from '@/lib/auth/secret'

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await consumeMagicLink(token)
  if (!r.ok) redirect(`/login/invalid?reason=${r.reason === 'expired' ? 'expired' : 'used'}`)
  const jar = await cookies()
  jar.set(SESSION_COOKIE, signSession(r.userId, sessionSecret()), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: SESSION_TTL_MS / 1000, path: '/',
  })
  redirect(r.isAdmin ? '/admin' : '/app') // AUTH-04
}
```

`app/app/layout.tsx` (AUTH-11 — гейт кабинета; уроки под /app/lessons автоматически закрываются этим же layout — LES-06 включён):
```tsx
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth/current-user'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  if (!user) redirect('/login')
  return <>{children}</>
}
```

`app/app/page.tsx` — каркас кабинета Ф1 (список уроков со ссылками + кнопка выйти; полный кабинет — Ф2):
```tsx
import Link from 'next/link'
import { getContent } from '@/lib/content'
import { logoutAction } from '@/app/actions/logout'
import { t } from '@/lib/i18n'

export default function Cabinet() {
  const { course } = getContent()
  return (
    <main>
      <h1>{t.auth.cabinetTitle}</h1>
      <p>{t.auth.cabinetStub}</p>
      {course.modules.map(m => (
        <section key={m.id}><h3>{m.title}</h3>
          <ul>{m.lessons.map(l => <li key={l.id}><Link href={`/app/lessons/${l.id}`}>{l.id} · {l.title}</Link></li>)}</ul></section>
      ))}
      <form action={logoutAction}><button className="mdx-download" type="submit">{t.auth.logout}</button></form>
    </main>
  )
}
```

`app/actions/logout.ts`:
```ts
'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE } from '@/lib/auth/session'

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE)
  redirect('/')
}
```

ВНИМАНИЕ: страница урока лежит в `app/app/lessons/[lessonId]/` — новый `app/app/layout.tsx` закрывает и её (LES-06 теперь активен). Enrollment-проверка (не просто логин, а доступ к курсу) — в layout НЕ нужна для Ф1: доступ выдаётся только с Enrollment (ADM-03), а users без enrollment не существуют, кроме админов — им доступ к урокам допустим.

- [ ] **Step 6: typecheck/lint/test/build.** Ручной smoke без БД: /login открывается; /app редиректит на /login; /auth/абракадабра → /login/invalid. **Commit** `"Ф1: magic link вход, сессии, гейт кабинета (AUTH-01…11, LES-06)"`.

---

### Task 9: Админка — каркас, заявки, выдача доступа (ADM-01…04)

**Files:**
- Create: `app/admin/layout.tsx`, `app/admin/page.tsx` (заявки), `app/admin/students/page.tsx`, `lib/admin/grant-access.ts`, `app/actions/admin.ts`, `components/admin.css` (@import в globals.css)
- Modify: `lib/i18n/ru.ts` (раздел `admin`)

- [ ] **Step 1: строки `admin`** в ru.ts: title 'Админка', registrations 'Заявки', students 'Студенты', emails 'Письма', grant 'Выдать доступ', granted 'Доступ уже выдан', resubmitted 'повторная', alreadyEnrolled 'уже зачислен', exportCsv 'Экспорт CSV (рассылка)', gdprDelete 'Удалить студента и все данные', gdprConfirm 'Для подтверждения введите email студента', resend 'Отправить повторно', statusNew 'новая', statusEnrolled 'зачислен', noData 'Пока пусто'.

- [ ] **Step 2: `app/admin/layout.tsx`** (ADM-01: не-админу — 404, не редирект на логин, чтобы не раскрывать существование админки):

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { currentUser, isAdminEmail } from '@/lib/auth/current-user'
import { t } from '@/lib/i18n'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser()
  if (!user || !isAdminEmail(user.email)) notFound() // ADM-01 + AUTH-10 (по env, на каждый запрос)
  return (
    <>
      <nav className="admin-nav">
        <Link href="/admin">{t.admin.registrations}</Link>
        <Link href="/admin/students">{t.admin.students}</Link>
        <Link href="/admin/emails">{t.admin.emails}</Link>
      </nav>
      {children}
    </>
  )
}
```

- [ ] **Step 3: `lib/admin/grant-access.ts`** (F2 — транзакция; ADM-03/04):

```ts
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { renderEmail } from '@/lib/email/templates'
import { newToken, hashToken, MAGIC_TTL_MS } from '@/lib/auth/magic-link'
import { t } from '@/lib/i18n'

export type GrantResult = 'granted' | 'already' | 'not_found'

export async function grantAccess(registrationId: string, adminUserId: string): Promise<GrantResult> {
  const reg = await db.registration.findUnique({ where: { id: registrationId } })
  if (!reg) return 'not_found'
  try {
    const { user, raw } = await db.$transaction(async tx => {
      const user = await tx.user.upsert({
        where: { email: reg.email },
        update: {},
        create: { email: reg.email, firstName: reg.firstName, lastName: reg.lastName, phone: reg.phone, telegram: reg.telegram },
      })
      await tx.consent.updateMany({ where: { email: reg.email, userId: null }, data: { userId: user.id } }) // F2: consents получают userId
      await tx.enrollment.create({ data: { userId: user.id, grantedById: adminUserId } }) // бросит P2002 при дубле (ADM-04)
      await tx.registration.update({ where: { id: reg.id }, data: { status: 'ENROLLED', alreadyEnrolled: true } })
      const raw = newToken()
      await tx.magicLink.create({ data: { tokenHash: hashToken(raw), email: reg.email, userId: user.id, expiresAt: new Date(Date.now() + MAGIC_TTL_MS) } })
      return { user, raw }
    })
    const url = `${process.env.APP_URL}/auth/${raw}`
    await sendEmail({
      to: user.email, userId: user.id, type: 'ACCESS_GRANTED', subject: t.email.accessSubject,
      html: renderEmail({ body: t.email.accessBody, buttonText: t.email.magicLinkButton, buttonUrl: url }),
      payload: { url },
    })
    return 'granted'
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') return 'already' // unique(userId, courseSlug) — ADM-04, письмо НЕ шлём
    throw e
  }
}
```

- [ ] **Step 4: `app/actions/admin.ts`** (тонкие action'ы с проверкой админа на КАЖДУЮ мутацию — SEC-05):

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { currentUser, isAdminEmail } from '@/lib/auth/current-user'
import { grantAccess } from '@/lib/admin/grant-access'

async function requireAdmin() {
  const user = await currentUser()
  if (!user || !isAdminEmail(user.email)) throw new Error('forbidden')
  return user
}

export async function grantAccessAction(formData: FormData) {
  const admin = await requireAdmin()
  await grantAccess(String(formData.get('registrationId')), admin.id)
  revalidatePath('/admin')
}
```

- [ ] **Step 5: `app/admin/page.tsx`** — таблица заявок (ADM-02): имя, email, статус (t.admin.statusNew/resubmitted/statusEnrolled), submitCount>1 → пометка resubmitted, alreadyEnrolled → пометка; кнопка-форма grant у не-ENROLLED:

```tsx
import { db } from '@/lib/db'
import { grantAccessAction } from '@/app/actions/admin'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export default async function Registrations() {
  const regs = await db.registration.findMany({ orderBy: { updatedAt: 'desc' } })
  if (regs.length === 0) return <main><h1>{t.admin.registrations}</h1><p>{t.admin.noData}</p></main>
  return (
    <main className="admin-wide">
      <h1>{t.admin.registrations}</h1>
      <table className="admin-table">
        <tbody>
        {regs.map(r => (
          <tr key={r.id}>
            <td>{r.firstName} {r.lastName}</td>
            <td>{r.email}</td>
            <td>
              {r.status === 'ENROLLED' ? t.admin.statusEnrolled : r.status === 'RESUBMITTED' ? t.admin.resubmitted : t.admin.statusNew}
              {r.submitCount > 1 && ` ×${r.submitCount}`}
              {r.alreadyEnrolled && r.status !== 'ENROLLED' && ` · ${t.admin.alreadyEnrolled}`}
            </td>
            <td>{r.status !== 'ENROLLED' && (
              <form action={grantAccessAction}>
                <input type="hidden" name="registrationId" value={r.id} />
                <button className="mdx-download" type="submit">{t.admin.grant}</button>
              </form>
            )}</td>
          </tr>
        ))}
        </tbody>
      </table>
    </main>
  )
}
```

- [ ] **Step 6: `app/admin/students/page.tsx`** — список User + дата Enrollment (`db.user.findMany({ include: { enrollments: true } })`), пока без прогресса (ADM-05 — Ф2); тут же кнопки GDPR (подключатся в Task 12 — в этой задаче просто список). `components/admin.css`: `.admin-nav { display:flex; gap:1.5rem; padding:1rem; } .admin-table { width:100%; border-collapse:collapse; } .admin-table td { border-top:1px solid color-mix(in srgb, var(--paper) 15%, transparent); padding:.6rem .8rem; } .admin-wide { max-width: 72rem; }` + @import.

- [ ] **Step 7: typecheck/lint/test/build; smoke без БД: /admin без сессии → 404. Commit** `"Ф1: админка — заявки и выдача доступа (ADM-01…04)"`.

---

### Task 10: Админка — email_log и переотправка (ADM-08, MAIL-05)

**Files:**
- Create: `app/admin/emails/page.tsx`, `lib/admin/resend-email.ts`
- Modify: `app/actions/admin.ts`

- [ ] **Step 1: `lib/admin/resend-email.ts`** (переотправка = НОВАЯ запись в email_log — MAIL-05; и НОВЫЙ токен — D-028: сырых токенов в payload нет, свежая ссылка полезнее истёкшей):

```ts
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { renderEmail } from '@/lib/email/templates'
import { mintLoginUrl } from '@/lib/auth/magic-link' // хелпер из T8-фикса D-028
import { t } from '@/lib/i18n'

export async function resendFromLog(emailLogId: string): Promise<'sent' | 'not_found'> {
  const log = await db.emailLog.findUnique({ where: { id: emailLogId } })
  if (!log) return 'not_found'
  const url = await mintLoginUrl(log.toEmail) // D-028: всегда свежий токен
  const body = log.type === 'MAGIC_LINK' ? t.email.magicLinkBody : t.email.accessBody
  await sendEmail({
    to: log.toEmail, userId: log.userId, type: log.type, subject: log.subject,
    html: renderEmail({ body, buttonText: t.email.magicLinkButton, buttonUrl: url }),
    payload: {},
  })
  return 'sent'
}
```

- [ ] **Step 2: action** в `app/actions/admin.ts`:

```ts
export async function resendEmailAction(formData: FormData) {
  await requireAdmin()
  const { resendFromLog } = await import('@/lib/admin/resend-email')
  await resendFromLog(String(formData.get('emailLogId')))
  revalidatePath('/admin/emails')
}
```

- [ ] **Step 3: `app/admin/emails/page.tsx`** — таблица email_log (последние 100, orderBy createdAt desc): дата, адресат, тип, статус (FAILED — классом .form-alert), attempts, lastError, кнопка t.admin.resend (форма с emailLogId → resendEmailAction). `export const dynamic = 'force-dynamic'`.

- [ ] **Step 4: проверки + Commit** `"Ф1: email_log в админке + ручная переотправка (ADM-08, MAIL-05)"`.

---

### Task 11: CSV-экспорт рассылки (ADM-09)

**Files:**
- Create: `lib/admin/newsletter-csv.ts`, `lib/admin/newsletter-csv.test.ts`, `app/admin/export/csv/route.ts`
- Modify: `app/admin/students/page.tsx` (ссылка-кнопка на экспорт)

- [ ] **Step 1: Failing-тест чистой части**:

```ts
import { describe, it, expect } from 'vitest'
import { buildNewsletterCsv } from './newsletter-csv'

describe('buildNewsletterCsv', () => {
  const consent = (email: string, granted: boolean, at: number) => ({ email, granted, createdAt: new Date(at) })
  const reg = (email: string, firstName = 'И', lastName = 'С', phone: string | null = null, telegram: string | null = null) =>
    ({ email, firstName, lastName, phone, telegram })

  it('только действующее согласие NEWSLETTER попадает в CSV', () => {
    const csv = buildNewsletterCsv(
      [reg('yes@a.b'), reg('no@a.b'), reg('revoked@a.b')],
      [consent('yes@a.b', true, 1), consent('no@a.b', false, 1), consent('revoked@a.b', true, 1), consent('revoked@a.b', false, 2)],
    )
    expect(csv).toContain('yes@a.b')
    expect(csv).not.toContain('no@a.b')
    expect(csv).not.toContain('revoked@a.b')
  })
  it('экранирует запятые/кавычки и содержит дату согласия', () => {
    const csv = buildNewsletterCsv([reg('a@b.c', 'Имя, с запятой', 'Фа"милия')], [consent('a@b.c', true, 1700000000000)])
    expect(csv).toContain('"Имя, с запятой"')
    expect(csv).toContain('"Фа""милия"')
    expect(csv.split('\n')[0]).toBe('firstName,lastName,email,phone,telegram,consentDate')
  })
})
```

- [ ] **Step 2: Red.** **Step 3: `lib/admin/newsletter-csv.ts`**

```ts
import { latestConsentByEmail } from '@/lib/registration/consents'

type Contact = { email: string; firstName: string; lastName: string; phone: string | null; telegram: string | null }
type ConsentRow = { email: string; granted: boolean; createdAt: Date }

const esc = (v: string | null) => {
  const s = v ?? ''
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** ADM-09: только контакты с действующим согласием NEWSLETTER (последняя запись granted=true). */
export function buildNewsletterCsv(contacts: Contact[], newsletterConsents: ConsentRow[]): string {
  const latest = latestConsentByEmail(newsletterConsents)
  const lastDate = new Map<string, Date>()
  for (const c of newsletterConsents) {
    const prev = lastDate.get(c.email)
    if (!prev || c.createdAt > prev) lastDate.set(c.email, c.createdAt)
  }
  const rows = contacts.filter(c => latest.get(c.email) === true)
    .map(c => [esc(c.firstName), esc(c.lastName), esc(c.email), esc(c.phone), esc(c.telegram), lastDate.get(c.email)!.toISOString()].join(','))
  return ['firstName,lastName,email,phone,telegram,consentDate', ...rows].join('\n')
}
```

- [ ] **Step 4: Green.** **Step 5: `app/admin/export/csv/route.ts`** — GET: проверка админа (currentUser + isAdminEmail, иначе 404), собрать контакты из Registration (там телефон/telegram есть всегда) + consents type NEWSLETTER, отдать `new Response('﻿' + csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="newsletter.csv"' } })` (BOM — чтобы Excel открыл кириллицу). Ссылка `<a className="mdx-download" href="/admin/export/csv">{t.admin.exportCsv}</a>` на странице students.

- [ ] **Step 6: проверки + Commit** `"Ф1: CSV-экспорт с действующим согласием на рассылку (ADM-09)"`.

---

### Task 12: GDPR-удаление и отписка (ADM-10/11, MAIL-06/07, CERT-07-заготовка)

**Files:**
- Create: `lib/admin/gdpr.ts`, `app/unsubscribe/[token]/page.tsx`
- Modify: `app/actions/admin.ts`, `app/admin/students/page.tsx` (форма удаления), `lib/i18n/ru.ts` (unsubscribe-строки)

- [ ] **Step 1: `lib/admin/gdpr.ts`** (одна транзакция; порядок из docs/data-model.md «Судьба записей»):

```ts
import { db } from '@/lib/db'

export type GdprResult = 'deleted' | 'not_found' | 'email_mismatch'

/** ADM-10/11: необратимое удаление; Certificate обезличивается и отзывается (D-010, CERT-07). */
export async function gdprDeleteStudent(userId: string, confirmEmail: string): Promise<GdprResult> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) return 'not_found'
  if (user.email !== confirmEmail.trim().toLowerCase()) return 'email_mismatch' // ADM-11: ввод email
  await db.$transaction(async tx => {
    await tx.certificate.updateMany({ where: { userId }, data: { userId: null, fullName: null, status: 'REVOKED', revokedAt: new Date() } })
    await tx.magicLink.deleteMany({ where: { email: user.email } })
    await tx.consent.deleteMany({ where: { email: user.email } })
    await tx.registration.deleteMany({ where: { email: user.email } })
    await tx.user.delete({ where: { id: userId } }) // enrollment/progress/quiz/deferred/submission/emailLog/trainerUsage — onDelete: Cascade
  })
  return 'deleted'
}
```
(Каскады заданы в схеме — перепроверь список против data-model.md таблицы «Судьба записей при GDPR-удалении»; Certificate.userId имеет onDelete: SetNull, но мы обезличиваем ДО удаления, чтобы записать REVOKED+revokedAt.)

- [ ] **Step 2: action + форма.** В `app/actions/admin.ts`:

```ts
export async function gdprDeleteAction(formData: FormData) {
  await requireAdmin()
  const { gdprDeleteStudent } = await import('@/lib/admin/gdpr')
  await gdprDeleteStudent(String(formData.get('userId')), String(formData.get('confirmEmail')))
  revalidatePath('/admin/students')
}
```
На `app/admin/students/page.tsx` у каждого студента: форма с hidden userId + `<input name="confirmEmail" placeholder={t.admin.gdprConfirm} required />` + кнопка t.admin.gdprDelete (класс .form-alert). Несовпадение email просто не удаляет (страница перерисуется без изменений) — достаточно для Ф1.

- [ ] **Step 3: `app/unsubscribe/[token]/page.tsx`** (MAIL-06; страница, не action — переход из письма):

```tsx
import { readUnsubToken } from '@/lib/email/unsubscribe-token'
import { appendConsent } from '@/lib/registration/consents'
import { t } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
export default async function Unsubscribe({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const email = readUnsubToken(token, sessionSecret()) // import { sessionSecret } from '@/lib/auth/secret'
  if (email) await appendConsent({ email, type: 'NEWSLETTER', granted: false, source: 'UNSUBSCRIBE_LINK' })
  return (
    <main>
      <h1>{email ? t.unsub.doneTitle : t.unsub.badTitle}</h1>
      <p>{email ? t.unsub.doneBody : t.unsub.badBody}</p>
    </main>
  )
}
```
Строки в ru.ts: `unsub: { doneTitle: 'Вы отписаны', doneBody: 'Больше писем о новостях не будет. Письма для входа и сертификаты приходят всегда — они нужны для учёбы.', badTitle: 'Ссылка не распознана', badBody: 'Похоже, ссылка повреждена. Напишите нам, и мы отпишем вас вручную.' }` (второе предложение doneBody — это MAIL-07 человеческим языком).

- [ ] **Step 4: проверки + Commit** `"Ф1: GDPR-удаление с подтверждением и отписка (ADM-10/11, MAIL-06/07)"`.

---

### Task 13: SEO-база (SEO-01, 02, 03, 07)

**Files:**
- Create: `app/sitemap.ts`, `app/robots.ts`
- Modify: `app/layout.tsx` (metadataBase, дефолтные OG), `app/page.tsx`, `app/ai-basics/page.tsx` (metadata)

- [ ] **Step 1: `app/layout.tsx`** — расширить metadata:

```ts
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: { default: t.seo.homeTitle, template: '%s — CRAT studio' },
  description: t.seo.homeDescription,
  alternates: { canonical: '/' },
  openGraph: { siteName: 'CRAT studio', locale: 'ru_RU', type: 'website' },
}
```
Строки в ru.ts: `seo: { homeTitle: 'CRAT studio — курсы об искусственном интеллекте для взрослых', homeDescription: 'Онлайн-курсы CRAT studio: искусственный интеллект в работе и жизни — просто, по-русски, с сертификатом.', landingTitle: 'Курс «Искусственный интеллект в профессиональной и личной деятельности»', landingDescription: '12 уроков, тренажёры, мини-проект и именной сертификат. Для взрослых без технической подготовки.' }`.

- [ ] **Step 2:** в `app/ai-basics/page.tsx`: `export const metadata: Metadata = { title: t.seo.landingTitle, description: t.seo.landingDescription, alternates: { canonical: '/ai-basics' } }`.

- [ ] **Step 3: `app/sitemap.ts`** (SEO-03; /app, /admin, служебные — НЕ включать):

```ts
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? 'http://localhost:3000'
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/ai-basics`, changeFrequency: 'weekly', priority: 0.9 },
  ]
}
```

`app/robots.ts`:
```ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? 'http://localhost:3000'
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/app', '/admin', '/auth/', '/login', '/api/', '/content-assets/', '/unsubscribe/'] }],
    sitemap: `${base}/sitemap.xml`,
  }
}
```

- [ ] **Step 4: smoke:** build+start → `curl /sitemap.xml` (2 URL), `/robots.txt` (disallow-список), `curl -s / | grep og:` (OG-теги в HTML). **Commit** `"Ф1: SEO-база — metadata, sitemap, robots, canonical (SEO-01…03, 07)"`.

---

### Task 14: seed v1 + финальный прогон

**Files:**
- Modify: `scripts/seed.ts`

- [ ] **Step 1: seed v1** — добавить блок Ф1 (docs/seed.md; идемпотентно, только `*@seed.crat.example`):

```ts
import { syncAdmins } from '@/lib/auth/sync-admins'
import { db } from '@/lib/db'
import { newToken, hashToken, MAGIC_TTL_MS } from '@/lib/auth/magic-link'

const SEED = (n: string) => `${n}@seed.crat.example`

async function seedF1() {
  // Заявка NEW с обоими согласиями
  await db.registration.upsert({ where: { email: SEED('zayavka') }, update: {},
    create: { email: SEED('zayavka'), firstName: 'Зоя', lastName: 'Заявкина' } })
  for (const [type, granted] of [['DATA_PROCESSING', true], ['NEWSLETTER', true]] as const)
    await db.consent.create({ data: { email: SEED('zayavka'), type, granted, source: 'REGISTRATION_FORM' } })

  // Повторная заявка, БЕЗ рассылки (для CSV-фильтра)
  await db.registration.upsert({ where: { email: SEED('povtor') },
    update: { status: 'RESUBMITTED', submitCount: 2 },
    create: { email: SEED('povtor'), firstName: 'Пётр', lastName: 'Повторов', status: 'RESUBMITTED', submitCount: 2 } })
  await db.consent.create({ data: { email: SEED('povtor'), type: 'DATA_PROCESSING', granted: true, source: 'REGISTRATION_FORM' } })
  await db.consent.create({ data: { email: SEED('povtor'), type: 'NEWSLETTER', granted: false, source: 'REGISTRATION_FORM' } })

  // Студент: User + Enrollment + ENROLLED-заявка
  const student = await db.user.upsert({ where: { email: SEED('student') }, update: {},
    create: { email: SEED('student'), firstName: 'Света', lastName: 'Студентова' } })
  await db.enrollment.upsert({ where: { userId_courseSlug: { userId: student.id, courseSlug: 'ai-basics' } }, update: {},
    create: { userId: student.id } })
  await db.registration.upsert({ where: { email: SEED('student') }, update: { status: 'ENROLLED' },
    create: { email: SEED('student'), firstName: 'Света', lastName: 'Студентова', status: 'ENROLLED', alreadyEnrolled: true } })
  for (const [type, granted] of [['DATA_PROCESSING', true], ['NEWSLETTER', true]] as const)
    await db.consent.create({ data: { email: SEED('student'), userId: student.id, type, granted, source: 'REGISTRATION_FORM' } })

  // Готовые magic-link URL в stdout (docs/seed.md «Вход студентом без почты») — Resend не нужен
  for (const email of [SEED('student'), ...((process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean))]) {
    const user = await db.user.findUnique({ where: { email } })
    if (!user) continue
    const raw = newToken()
    await db.magicLink.create({ data: { tokenHash: hashToken(raw), email, userId: user.id, expiresAt: new Date(Date.now() + MAGIC_TTL_MS) } })
    console.log(`[seed v1] вход для ${email}: ${process.env.APP_URL ?? 'http://localhost:3000'}/auth/${raw}`)
  }
}

async function main() {
  const admins = await syncAdmins()
  console.log(`[seed v0] админы синхронизированы: ${admins.join(', ') || '(ADMIN_EMAILS пуст)'}`)
  await seedF1()
  console.log('[seed v1] заявки/студент/ссылки готовы')
}
main().catch(e => { console.error('[seed] ошибка:', e); process.exitCode = 1 }).finally(() => db.$disconnect())
```
Consent.create в seed НЕ идемпотентен буквально (append-only журнал) — повторный прогон добавит записи; это допустимо: «действующее согласие» берётся последней записью, дубли истории не ломают смысла (D-014). Отметить в отчёте.

- [ ] **Step 2: Финальный прогон всего:** `npm run typecheck && npm run lint && npm test && npm run build` — зелёные. **Step 3: Commit** `"Ф1: seed v1 — заявки, студент, magic-ссылки в stdout"`.

---

## Внешние шаги Ивана (закрытие Ф1)

1. Resend: домен cratstudio.com Verified + `RESEND_API_KEY` в Render (инструкция уже выдана).
2. `ADMIN_EMAILS` в Render (кто админ), `APP_URL=https://cratstudio.com`.
3. Текст согласия на обработку ПД — черновик стоит, финальный от Ивана (правится в ru.ts).
4. Smoke-чеклист Ф1 из docs/phases.md (7 шагов, ~10 минут) — на проде после деплоя.

## Self-review

- Spec coverage: SITE-01…06 (T7), REG-01…09 (T6, T7-форма), AUTH-01…11 (T1, T8), ADM-01…04 (T9), ADM-08 (T10), ADM-09 (T11), ADM-10/11 (T12), MAIL-01/03/04/05 (T4, T10), MAIL-06/07 (T3, T12), SEC-03 (T2), SEC-05 (actions с requireAdmin/сессией), SEC-06 (T8 — одинаковый ответ), SEO-01…03/07 (T13), seed Ф1 (T14), LES-06 (T8 layout).
- ADM-05 (прогресс студентов) — сознательно Ф2 (по phases.md). Письмо CERTIFICATE — Ф3.
- Типовая согласованность: session.ts экспортирует SESSION_COOKIE/SESSION_TTL_MS — используются в T8; limiters из T2 — в T6/T8; sendEmail(payload) — Prisma.InputJsonValue; grantAccess использует newToken/hashToken из T8-модуля (T9 после T8 в порядке исполнения — зависимость учтена: T8 создаёт lib/auth/magic-link.ts, T9 его импортирует).
- Порядок задач: 1→2→3→4→5→6→7→8→9→10→11→12→13→14 (T9 зависит от T8; T6 от T2/T5; T10 от T4).
