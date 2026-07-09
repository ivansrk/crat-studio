# Ф7а «Вход по паролю» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development или superpowers:executing-plans. Шаги — чекбоксы (`- [ ]`). TDD для чистых частей (генерация пароля, хэш-обёртка, rate-limit).

**Goal:** Заменить magic-link-вход на email+пароль. Новый и существующий пользователь входят паролем; создание учётки генерирует пароль (показ один раз + письмо WELCOME); reset/первый-вход через переиспользованную token-механику; смена пароля в кабинете; существующие юзеры (passwordHash=null) не заблокированы.

**Architecture:** `lib/auth/password.ts` (bcryptjs хэш/сверка, D-032; генерация читаемого пароля, D-033 — чистое, TDD). `MagicLink` → `PasswordResetToken` (+`purpose`, TTL 60м, D-031) в `lib/auth/reset.ts` (переиспользует хэш/гашение из magic-link.ts). Вход — `lib/auth/login.ts` (сверка + rate-limit AUTH-20). Точки создания пароля: `lib/admin/grant-access.ts` и будущий invite-confirm (Ф7б) зовут общий `createUserWithPassword`.

**Спеки:** requirements §2/§2а (AUTH-01…21); flows F10–F13, E-PWD1…4; data-model «Пакет Ф7 §1»; D-031…D-034; phases Ф7а.

**Правила исполнителям:** открытый пароль — только в письме WELCOME и на экране успеха, НИКОГДА в БД/логах/email_log payload (D-028/AUTH-14); ответы входа не раскрывают состояние (SEC-06); все строки — ru.ts; на проде есть данные — миграция аддитивная, выкат по data-model «Порядок безопасного выката».

---

### Task 1: Prisma-миграция Ф7а (аддитивная)

**Files:** Modify `prisma/schema.prisma`, генерация миграции

- [ ] `User`: `passwordHash String?`, `whatsapp String?`, `resendContactId String?` (последние два нужны Ф7б, но добавляем одной миграцией — дёшево и nullable).
- [ ] `MagicLink` → переименовать модель в `PasswordResetToken`; добавить `enum ResetTokenPurpose { PASSWORD_RESET OPT_IN }` и поле `purpose ResetTokenPurpose @default(PASSWORD_RESET)`; TTL-комментарий 60 мин; сохранить `@@map("magic_links")` ИЛИ переименовать таблицу (если переименовываем — миграция дропнет/создаст; строки эфемерны, безопасно; зафиксируй выбор в отчёте).
- [ ] `EmailType` += `WELCOME PASSWORD_RESET DOUBLE_OPT_IN CONSULTATION` (append — безопасно).
- [ ] `npx prisma migrate dev --name f7a_passwords`; `prisma generate`. typecheck.
- [ ] Обнови все импорты `MagicLink`/`magicLink` → `PasswordResetToken`/`passwordResetToken` (магик-линк-модуль перепишется в Task 4). Commit `"Ф7а: миграция — passwordHash, PasswordResetToken, новые EmailType (D-031/D-032)"` (+трейлер Co-Authored-By: Claude Fable 5 <noreply@anthropic.com> — везде далее).

---

### Task 2: lib/auth/password.ts — хэш + генерация (TDD)

**Files:** Create `lib/auth/password.ts`, `lib/auth/password.test.ts`; Modify `package.json` (bcryptjs)

- [ ] `npm i bcryptjs @types/bcryptjs`.
- [ ] Failing-тесты (генерация): длина ≥12; только из безопасного алфавита без `0O1lI`; формат групп `xxxx-xxxx-xxxx`; два вызова дают разные пароли.

```ts
import { describe, it, expect } from 'vitest'
import { generatePassword } from './password'
describe('generatePassword (D-033)', () => {
  it('≥12 символов, читаемый, без неоднозначных', () => {
    const p = generatePassword()
    expect(p.replace(/-/g, '').length).toBeGreaterThanOrEqual(12)
    expect(p).toMatch(/^[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}-[a-hj-km-np-z2-9]{4}$/)
  })
  it('уникален', () => expect(generatePassword()).not.toBe(generatePassword()))
})
```

- [ ] Реализация: `generatePassword()` через `crypto.randomInt` по алфавиту `abcdefghjkmnpqrstuvwxyz23456789`; `hashPassword(raw): Promise<string>` = bcrypt.hash(raw, 12); `verifyPassword(raw, hash): Promise<boolean>` = bcrypt.compare. (hash/verify не юнит-тестируем на конкретный вывод — соль случайна; можно round-trip тест hash→verify=true.)
- [ ] Green. typecheck/lint/test. Commit `"Ф7а: lib/auth/password — bcryptjs хэш + генерация читаемого пароля (D-032/D-033)"`.

---

### Task 3: lib/auth/login.ts — вход + rate-limit (AUTH-12/13/20)

**Files:** Create `lib/auth/login.ts`; Modify `lib/auth/rate-limit.ts` (лимитеры перебора)

- [ ] rate-limit.ts: добавить в синглтон `loginEmail: new RateLimiter(10, 15*60*1000)`, `loginIp: new RateLimiter(20, 15*60*1000)` (AUTH-20).
- [ ] `login.ts`: `attemptLogin(email, password, ip): Promise<{ ok: true; userId; isAdmin } | { ok: false }>`:
  - нормализация email; проверка `loginEmail`/`loginIp` (при отказе → `{ok:false}`, наружу то же сообщение);
  - `user = findUnique`; если нет ИЛИ `passwordHash===null` ИЛИ `!verifyPassword` → `{ok:false}` (AUTH-13/19);
  - успех → сбросить счётчик loginEmail для ключа (метод `reset(key)` в RateLimiter), вернуть userId + isAdminEmail.
- [ ] Тест attemptLogin с моками db/limiters: неверный пароль, null-хэш, успех, лимит.
- [ ] Commit `"Ф7а: вход по паролю + rate-limit перебора (AUTH-12/13/19/20)"`.

---

### Task 4: lib/auth/reset.ts — reset/первый-вход (AUTH-16/17), переписать magic-link

**Files:** Create `lib/auth/reset.ts`; Modify/rename `lib/auth/magic-link.ts` (гашение токена переиспользуется), удалить `requestMagicLink`/`consumeMagicLink` вход-логику

- [ ] Оставить чистые хелперы `newToken`, `hashToken` (D-009). Новый TTL `RESET_TTL_MS = 60*60*1000`.
- [ ] `mintResetToken(email, purpose='PASSWORD_RESET')`: создать PasswordResetToken (хэш, expiresAt, purpose, userId если есть). Вернуть URL `/reset/{raw}` (для OPT_IN — `/invite-confirm/{raw}`, Ф7б переиспользует).
- [ ] `requestPasswordReset(email)`: rate-limit (AUTH-08 magicLink-лимитер переименовать в resetLimiter), user есть → mint + письмо PASSWORD_RESET; наружу всегда одинаково (AUTH-16, SEC-06).
- [ ] `consumeResetToken(raw): { ok:true; email; tokenId } | { ok:false; reason }`: findUnique, проверки used/expired, атомарный `updateMany usedAt WHERE usedAt IS NULL` (переиспользовать паттерн consumeMagicLink); НЕ логинит.
- [ ] `setPasswordViaToken(raw, newPassword)`: consume → hashPassword → update user.passwordHash. Валидация ≥8 (AUTH-17).
- [ ] Commit `"Ф7а: reset/первый-вход на переиспользованной token-механике (AUTH-16/17, D-031)"`.

---

### Task 5: createUserWithPassword + grant-access (AUTH-15, F11)

**Files:** Create `lib/auth/provision.ts`; Modify `lib/admin/grant-access.ts`, `lib/email/templates.ts`, `lib/i18n/ru.ts`

- [ ] `provision.ts` `createUserWithPassword(tx, data): { user, plainPassword }`: генерирует пароль, хэширует, создаёт/апдейтит User с passwordHash. Возвращает открытый пароль ТОЛЬКО как return-значение (не пишет никуда).
- [ ] `grant-access.ts`: в транзакции заменить `user.upsert` на `createUserWithPassword`; после транзакции — письмо `WELCOME` (пароль + ссылка на курс/вход) вместо ACCESS_GRANTED+magic-link. Открытый пароль в письмо (renderEmail с паролем), payload email_log — БЕЗ пароля (D-028). Экран админки после выдачи показывает пароль один раз (redirect с одноразовым флагом или показать на странице заявки).
- [ ] ru.ts email: `welcomeSubject`, `welcomeBody` (с плейсхолдером пароля/ссылки), `resetSubject`, `resetBody`, `resetButton`. Тексты — черновики [текст на согласование].
- [ ] Commit `"Ф7а: createUserWithPassword + WELCOME-письмо при выдаче доступа (AUTH-15, F11)"`.

---

### Task 6: Роуты/страницы — /login, /reset, /app/account (F10/F12/F13)

**Files:** Create `app/login/page.tsx` (переписать), `app/actions/login.ts`, `app/reset/page.tsx` + `app/reset/[token]/page.tsx`, `app/actions/reset.ts`, `app/app/account/page.tsx`, `app/actions/account.ts`; Modify `app/actions/request-link.ts` (удалить/переназначить), удалить `app/auth/[token]` (magic-link consume), обновить редиректы AUTH-11 на `/login`

- [ ] `/login`: форма email+пароль → loginAction → attemptLogin → set-cookie session → redirect кабинет/админка; ошибка → `?e=1` баннер (AUTH-13). Ссылка «Забыли пароль / первый вход» → `/reset`.
- [ ] `/reset`: форма email → requestPasswordReset → «если есть доступ, отправили». `/reset/[token]`: consume-проверка → форма нового пароля → setPasswordViaToken → «Пароль изменён» → `/login`. used/expired страницы (AUTH-05/06).
- [ ] `/app/account`: текущий+новый+повтор → проверка verifyPassword(текущий) → hash+update (AUTH-18).
- [ ] Удалить magic-link-вход: `app/auth/[token]`, `request-link` action, страницы login/sent старого флоу переназначить. Проверить, что `middleware`/layout-гейты редиректят на `/login`.
- [ ] Строки ru.ts (auth.*). Commit `"Ф7а: страницы вход/reset/смена пароля, снятие magic-link-входа (F10/F12/F13)"`.

---

### Task 7: Миграция существующих юзеров + разовая рассылка (D-034)

**Files:** Create `scripts/send-set-password.ts`; Modify `README.md` (заметка)

- [ ] Скрипт (идемпотентный): для каждого `User where passwordHash=null` → `mintResetToken(email)` + письмо PASSWORD_RESET (тема «Задайте пароль для входа»). Логировать сколько отправлено. Запускается вручную после деплоя Ф7а.
- [ ] README: раздел «Миграция на пароли»: порядок выката (data-model «Порядок безопасного выката»), команда скрипта, что существующие юзеры входят через «Забыли пароль» и без скрипта.
- [ ] Commit `"Ф7а: разовая set-password рассылка существующим юзерам (D-034)"`.

---

### Task 8: CLAUDE.md + seed + финальный прогон

**Files:** Modify `CLAUDE.md`, `scripts/seed.ts`, `docs/seed.md`

- [ ] CLAUDE.md: заменить «вход без паролей (magic link)» на «вход по email+паролю; сервер генерирует пароль, reset — по email-ссылке (D-031)».
- [ ] seed: seed-юзерам (admin@, student@, diplomant@) проставить known passwordHash (пароль в stdout вместо magic-ссылки). Обновить docs/seed.md.
- [ ] Финальный прогон: typecheck/lint/test/build; вход seed-паролем работает; reset-цикл вручную. Commit `"Ф7а: seed-пароли + правка CLAUDE.md (D-031)"`.

---

## Внешние шаги Ивана (закрытие Ф7а)
1. Утвердить тексты писем WELCOME и PASSWORD_RESET (ru.ts).
2. Подтвердить формат генерируемого пароля (D-033).
3. Дать команду на разовую set-password рассылку (Task 7), когда на проде появятся реальные юзеры.
4. Smoke-чеклист Ф7а из phases.md (5 шагов).

## Self-review
- AUTH-12/13 (T3), AUTH-14 (T2 хэш), AUTH-15 (T5 WELCOME), AUTH-16/17 (T4/T6 reset), AUTH-18 (T6 account), AUTH-19 (T3 null-хэш + T6 ссылка + T7 рассылка), AUTH-20 (T3 лимиты), AUTH-21 (T6 UX).
- Отмена magic-link-входа: T6 удаляет `/auth/[token]` и request-link.
- Порядок: T1→T2→T3→T4→T5→T6→T7→T8. Секреты/открытый пароль не в email_log payload (T5).
