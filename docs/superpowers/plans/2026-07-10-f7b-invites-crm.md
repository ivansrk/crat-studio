# Ф7б «Приток клиентов: инвайты, double opt-in, CRM, консультации» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development или superpowers:executing-plans. TDD для чистых частей (нормализация телефона, валидация формы, вычисление статуса подписки). **Зависит от Ф7а** (createUserWithPassword, PasswordResetToken с purpose=OPT_IN, WELCOME-письмо).

**Goal:** Инвайт-ссылки в админке → регистрация по ссылке с расширенной формой и double opt-in → авто-выдача по инвайту / ручная по публичной заявке → клиентская база в админке с поиском и Resend-синком → консультации (форма + админ-список).

**Architecture:** `lib/invite` (создание/отзыв/валидация инвайта, инкремент счётчика). `lib/registration` расширяется double-opt-in (mint OPT_IN-токен, confirm → авто/ручной путь по `inviteLinkId`, D-035). `lib/resend-audience` (синк контактов, устойчив к сбою, CRM-05). `lib/crm` (список/поиск/карточка — читает User/Consent/Enrollment). `lib/consultation` (создание + письмо CONSULTATION). Действующая подписка — единое правило D-014 (вынести в `lib/consent/effective.ts`, если ещё нет).

**Спеки:** requirements §17 (INV), §18 (REG-10…16), §19 (CRM), §21 (CONS); flows F14–F18, E-INV1…5, E-CRM1/2, E-CONS1; data-model «Пакет Ф7 §2–4»; D-035; phases Ф7б.

**Правила исполнителям:** телефон обязателен (REG-10/16); double opt-in — согласия действительны ТОЛЬКО после подтверждения (не писать Consent до confirm, data-model §2 рекомендованный вариант); Resend-сбой не роняет операцию (CRM-05); формат урока/контракт course-factory не трогать; все строки — ru.ts; тексты оффера/писем — черновики [текст на согласование].

---

### Task 1: Prisma-миграция Ф7б

**Files:** Modify `prisma/schema.prisma`

- [ ] `InviteLink` (data-model §2): token unique, courseSlug, sourceLabel, active, maxRegistrations Int?, registrationsCount, expiresAt?, createdById?, createdAt.
- [ ] `Registration` += `whatsapp String?`, `inviteLinkId String?`, `wantsNewsletter Boolean @default(false)`, `confirmedAt DateTime?`; `RegistrationStatus` += `PENDING_OPT_IN CONFIRMED`.
- [ ] `ConsultationRequest` + `enum ConsultationStatus { NEW CONTACTED CLOSED }` (data-model §4; userId без каскада).
- [ ] (User.resendContactId уже добавлен в Ф7а Task 1 — проверить.)
- [ ] `prisma migrate dev --name f7b_invites_crm`; generate; typecheck. Commit `"Ф7б: миграция — InviteLink, double opt-in поля, ConsultationRequest"` (+трейлер).

---

### Task 2: lib/invite — создание/валидация/отзыв (INV-01…06)

**Files:** Create `lib/invite/index.ts`, `lib/invite/index.test.ts`

- [ ] TDD чистой валидации `inviteState(invite, now, count)`: `'ok' | 'revoked' | 'expired' | 'exhausted'` (active=false→revoked; expiresAt<now→expired; maxRegistrations!=null && count>=max→exhausted).
- [ ] Prisma-слой: `createInvite({courseSlug, sourceLabel, maxRegistrations?, expiresAt?}, adminId)` (token = randomBytes hex); `revokeInvite(id)`; `getInviteByToken(token)`; `incrementInviteCount(tx, id)` (атомарно, в транзакции подтверждения); `listInvites()`.
- [ ] Commit `"Ф7б: lib/invite — создание, валидация, отзыв, счётчик (INV-01…06)"`.

---

### Task 3: Расширенная форма + double opt-in send (REG-10…12, F14/F15)

**Files:** Modify `lib/registration/index.ts`, `app/actions/register.ts`; Create `app/invite/[token]/page.tsx`; Modify `app/ai-basics` форма, `lib/i18n/ru.ts`; TDD `lib/registration/phone.test.ts`

- [ ] TDD: `normalizePhone` (trim, оставить цифры и ведущий `+`, REG-16); `validateRegistration` (телефон обяз., email/имя/фамилия обяз., dataConsent обяз.).
- [ ] `submitRegistration` расширить: принять whatsapp, inviteLinkId?, wantsNewsletter; создать/обновить Registration (REG-05) со статусом PENDING_OPT_IN; НЕ писать Consent сейчас (data-model §2); mint OPT_IN-токен (Ф7а mintResetToken с purpose OPT_IN, ссылка `/invite-confirm/{raw}`); письмо DOUBLE_OPT_IN; вернуть `'pending'`.
- [ ] `/invite/[token]`: getInviteByToken → inviteState; не ok → страница «Ссылка недействительна» (INV-04, E-INV1); ok → форма (телефон обяз., whatsapp, чекбоксы) с hidden inviteToken.
- [ ] Публичная форма /ai-basics: та же форма без inviteLinkId; после submit — «Проверьте почту».
- [ ] registerAction: rate-limit (REG-07), returnTo whitelist (+ `/invite/{token}`), redirect на «проверьте почту».
- [ ] ru.ts (register.*, email.doubleOptIn*). Commit `"Ф7б: расширенная форма + double opt-in отправка (REG-10…12, F14/F15)"`.

---

### Task 4: Подтверждение double opt-in → авто/ручная выдача (REG-13…15, D-035)

**Files:** Create `app/invite-confirm/[token]/page.tsx`, `lib/registration/confirm.ts`; Modify `lib/i18n/ru.ts`

- [ ] `confirmRegistration(rawToken)`: consumeResetToken (Ф7а, purpose OPT_IN); найти Registration по email:
  - записать действующие Consent (DATA_PROCESSING granted; NEWSLETTER granted если wantsNewsletter) source=REGISTRATION_FORM;
  - **inviteLinkId задан (авто, D-035):** транзакция — createUserWithPassword (Ф7а) + Enrollment(source=sourceLabel) + incrementInviteCount + Registration.status=ENROLLED, confirmedAt; при подписке — enqueue Resend-синк (Task 6, вне транзакции, catch); вернуть `{mode:'auto', plainPassword, courseSlug}`;
  - **без инвайта (ручная):** Registration.status=CONFIRMED, confirmedAt; вернуть `{mode:'manual'}`;
  - уже ENROLLED с доступом → `{mode:'already'}` (REG-14, E-INV3);
  - exhausted инвайт на момент подтверждения → `{mode:'invite_gone'}` (E-INV2, мягко).
- [ ] Идемпотентность/гонка (E-INV5): unique(userId,courseSlug) на Enrollment ловит двойной клик; повтор consume → used.
- [ ] `/invite-confirm/[token]`: рендер по mode — auto: пароль (один раз) + ссылка на курс + WELCOME отправлено; manual: «Заявка подтверждена, доступ выдаст администратор»; already: «У вас уже есть доступ» + ссылка на /login и /reset; invalid/used/expired страницы.
- [ ] ru.ts. Commit `"Ф7б: подтверждение opt-in — авто по инвайту, ручная публичной (REG-13…15, D-035)"`.

---

### Task 5: grant-access для CONFIRMED-заявок (ADM-03 остаётся)

**Files:** Modify `lib/admin/grant-access.ts`, `app/admin` список заявок

- [ ] grant-access уже создаёт User+пароль+WELCOME (Ф7а). Проверить: работает для CONFIRMED публичных заявок; в списке заявок админки показывать статус (PENDING_OPT_IN / CONFIRMED / ENROLLED) и признак «email подтверждён».
- [ ] Не выдавать доступ по неподтверждённой (PENDING_OPT_IN) заявке — кнопка «выдать» активна только для CONFIRMED (или предупреждение).
- [ ] Commit `"Ф7б: выдача доступа по подтверждённым заявкам, статусы opt-in в админке"`.

---

### Task 6: lib/resend-audience — синк подписчиков (CRM-04…07, F17)

**Files:** Create `lib/resend-audience/index.ts`; Modify `lib/registration/confirm.ts`, `app/unsubscribe/[token]` flow, `lib/admin/gdpr` (delete)

- [ ] `syncContactSubscribe(user)`: если RESEND_AUDIENCE_ID пуст → no-op + warn (CRM-06); иначе Resend contacts.create/update по email → сохранить resendContactId; ошибка → throw наверх ловится вызывающим (не роняет операцию, CRM-05).
- [ ] `syncContactUnsubscribe(user)`: contacts.remove по resendContactId/email; те же гарантии.
- [ ] Встроить: confirm (подписка), unsubscribe (MAIL-06), gdpr-delete (перед удалением). Все вызовы — `.catch(e => { log; markResyncNeeded })`.
- [ ] Баннер рассинхрона в админке (флаг на User или лог-таблица — минимально: поле `resendSyncError String?` на User или просто лог + кнопка ресинка в карточке).
- [ ] Commit `"Ф7б: Resend Audience синк при подписке/отписке/GDPR (CRM-04…07)"`.

---

### Task 7: lib/crm + /admin/clients (CRM-01…03, F16)

**Files:** Create `lib/crm/index.ts`, `app/admin/clients/page.tsx`, `app/admin/clients/[userId]/page.tsx`, `app/actions/crm.ts`; Modify `app/admin/layout.tsx` (nav), `lib/i18n/ru.ts`, `lib/consent/effective.ts` (если нет — вынести правило D-014)

- [ ] `listClients(query?)`: User + последний Enrollment (max createdAt) + действующая подписка (D-014). Поиск по firstName/lastName/email/phone (contains, insensitive).
- [ ] `/admin/clients`: таблица (имя, фамилия, email, телефон, мессенджер, подписка, последний курс) + поле поиска (GET ?q=).
- [ ] `/admin/clients/[userId]`: профиль + история (заявка, consents, enrollments, ссылка на прогресс) + форма редактирования (firstName/lastName/phone/telegram/whatsapp; email read-only) → updateClientAction. Кнопка «пересинхронизировать Resend» (CRM-05).
- [ ] ru.ts (admin.clients.*). Commit `"Ф7б: клиентская база — список, поиск, карточка-редактирование (CRM-01…03)"`.

---

### Task 8: Консультации (CONS-01…06, F18)

**Files:** Create `lib/consultation/index.ts`, `app/consult/page.tsx` (или секция), `app/admin/consultations/page.tsx`, `app/actions/consultation.ts`; Modify `app/app/page.tsx` (блок оффера), `app/page.tsx` (#contact), `app/admin/layout.tsx`, `lib/i18n/ru.ts`

- [ ] `createConsultation({name, contact, message, topic?}, userId?, source)`: rate-limit 5/час/IP (CONS-05); create ConsultationRequest(NEW); письмо CONSULTATION админам (ADMIN_EMAILS → to, MAIL-03). Вернуть `'accepted'|'rate'`.
- [ ] Форма в кабинете (`/app` блок) и публично (страница `/consult` и/или секция #contact на главной): имя, контакт, направление (select опц.), описание.
- [ ] `/admin/consultations`: список NEW сверху; смена статуса NEW→CONTACTED→CLOSED (updateConsultationStatusAction).
- [ ] ru.ts: оффер консультаций (заголовки/направления — [текст на согласование]), формы, email CONSULTATION, admin.consultations.*.
- [ ] Commit `"Ф7б: консультации — форма, письмо админам, список со статусами (CONS-01…06)"`.

---

### Task 9: seed v4 + финальный прогон

**Files:** Modify `scripts/seed.ts`, `docs/seed.md`

- [ ] seed: один активный InviteLink (ссылка в stdout); одна PENDING_OPT_IN-заявка; один CONFIRMED-клиент с подпиской; одна ConsultationRequest(NEW). Идемпотентно.
- [ ] docs/seed.md — раздел Ф7б.
- [ ] typecheck/lint/test/build; seed без БД → exit 1. Commit `"Ф7б: seed v4 — инвайт, opt-in-заявка, клиент, консультация"`.

---

## Внешние шаги Ивана (закрытие Ф7б)
1. Создать Resend Audience → `RESEND_AUDIENCE_ID` в env.
2. Утвердить тексты письма подтверждения (DOUBLE_OPT_IN) и оффера консультаций.
3. Подтвердить D-035 (публичная заявка — ручная выдача; инвайт — авто).
4. Smoke-чеклист Ф7б из phases.md (6 шагов).

## Self-review
- INV-01…06 (T2/T3/T4), REG-10…16 (T3/T4/T5), CRM-01…07 (T6/T7), CONS-01…06 (T8).
- Double opt-in: согласия только после confirm (T3 не пишет, T4 пишет). Авто vs ручная — T4 по inviteLinkId (D-035). Resend-сбой не роняет (T6). Телефон обяз. (T3).
- Зависимости от Ф7а: createUserWithPassword, mint/consume OPT_IN-токен, WELCOME.
- Порядок: T1→T2→T3→T4→T5→T6→T7→T8→T9.
