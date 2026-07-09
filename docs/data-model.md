# Модель данных (Prisma / PostgreSQL)

Принципы:
- В базе — UTC; Europe/Warsaw только при отображении и в бизнес-правилах (вычисляется в коде).
- Email везде нормализован (trim + lowercase) до записи.
- Контент (уроки, квизы, тексты) в базе НЕ хранится (D-002) — только ссылки на `lessonId` вида `"1.1"` из course.yaml.
- GDPR-удаление: всё каскадом, кроме `Certificate` (обезличивается, D-010).

```prisma
// ------------------------------------------------------------------ enums

enum Role {
  STUDENT
  ADMIN // назначается синхронизацией с ADMIN_EMAILS при старте (AUTH-09)
}

enum RegistrationStatus {
  NEW         // первая заявка
  RESUBMITTED // повторная отправка того же email (REG-05)
  ENROLLED    // по заявке выдан доступ
}

enum ConsentType {
  DATA_PROCESSING // обязательное согласие на обработку ПД
  NEWSLETTER      // опциональное согласие на рассылку
}

enum ConsentSource {
  REGISTRATION_FORM
  ADMIN            // ручное изменение админом
  UNSUBSCRIBE_LINK // отписка из письма (MAIL-06)
}

enum SubmissionStatus {
  DRAFT
  SUBMITTED
  NEEDS_CHANGES
  APPROVED
}

enum CertificateStatus {
  VALID
  REVOKED // GDPR-удаление владельца (CERT-07)
}

enum EmailType {
  MAGIC_LINK
  ACCESS_GRANTED
  CERTIFICATE
}

enum EmailStatus {
  QUEUED // создано, отправка/ретраи идут
  SENT
  FAILED // 3 ретрая исчерпаны — видно в админке (MAIL-04)
}

// ------------------------------------------------------------------ модели

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  firstName String
  lastName  String
  phone     String?
  telegram  String?
  role      Role     @default(STUDENT)
  mission   String?  // личная миссия: заполняется в уроке 1.1, редактируема (CAB-02)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  enrollments   Enrollment[]
  progress      LessonProgress[]
  quizResults   QuizResult[]
  deferredState DeferredQuizState[]
  submissions   Submission[]
  certificates  Certificate[]
  consents      Consent[]
  emails        EmailLog[]
  trainerUsage  TrainerUsage[]
}

// Заявка с публичной формы. User создаётся ТОЛЬКО когда админ выдаёт доступ.
model Registration {
  id             String             @id @default(cuid())
  email          String             @unique // повторная отправка → update, не дубль (REG-05)
  firstName      String
  lastName       String
  phone          String?
  telegram       String?
  status         RegistrationStatus @default(NEW)
  source         String             @default("landing") // с какой страницы/ссылки пришла
  submitCount    Int                @default(1)         // сколько раз отправляли форму
  alreadyEnrolled Boolean           @default(false)     // пометка для админки (REG-09)
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt          // = дата последней отправки
}

// Append-only журнал согласий (D-014). Действующее = последняя запись (email, type).
// Ключ — email: согласие даётся до появления User; userId проставляется при создании User.
model Consent {
  id        String        @id @default(cuid())
  email     String
  userId    String?
  user      User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      ConsentType
  granted   Boolean
  source    ConsentSource
  createdAt DateTime      @default(now()) // дата дачи/отзыва согласия

  @@index([email, type, createdAt])
}

model Enrollment {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  courseSlug  String   @default("ai-basics")
  source      String   @default("manual") // задел под Stripe и др. (D-001)
  grantedById String?  // админ, выдавший доступ (без FK: админ может быть удалён из env)
  createdAt   DateTime @default(now())

  @@unique([userId, courseSlug]) // защита от двойной выдачи, ADM-04
}

// Одноразовые токены входа. Хранится только SHA-256 хэш (D-009).
model MagicLink {
  id        String    @id @default(cuid())
  tokenHash String    @unique
  email     String    // на кого выписан
  userId    String?   // может быть null, если письмо шлётся до захода (не используется в MVP)
  expiresAt DateTime  // createdAt + 15 минут (AUTH-03)
  usedAt    DateTime? // одноразовость: UPDATE ... WHERE usedAt IS NULL (AUTH-04)
  createdAt DateTime  @default(now())

  @@index([email, createdAt]) // rate limit 3/15мин (AUTH-08)
}

// Прогресс по уроку. lessonId — id из course.yaml ("1.1").
// «Пройден» для отображения = quizPassedAt && practiceDoneAt (живое, E16);
// completedAt — момент ПЕРВОГО достижения, не откатывается (для deferred/сертификата).
model LessonProgress {
  id             String    @id @default(cuid())
  userId         String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  courseSlug     String    @default("ai-basics")
  lessonId       String    // "1.1" … "4.3"
  firstOpenedAt  DateTime  @default(now())
  quizPassedAt   DateTime? // первый зачёт ≥2/3; не сбрасывается (LES-09)
  practiceDoneAt DateTime? // чекбокс «Сделал»; можно снять → null (LES-11)
  completedAt    DateTime? // ставится когда quizPassedAt && practiceDoneAt (LES-12, LES-13)
  updatedAt      DateTime  @updatedAt

  @@unique([userId, courseSlug, lessonId])
}

// Каждая попытка квиза — строка. Брошенный квиз: finishedAt = null (LES-10).
model QuizResult {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  courseSlug String    @default("ai-basics")
  lessonId   String
  attempt    Int       // 1, 2, … в рамках (userId, lessonId)
  answers    Json      // [{questionIndex, chosen, correct}] — по мере ответов
  score      Int       @default(0)
  total      Int       @default(3)
  passed     Boolean   @default(false) // score >= 2 (LES-08)
  startedAt  DateTime  @default(now())
  finishedAt DateTime?

  @@unique([userId, lessonId, attempt])
}

// Отложенное повторение: создаётся при completedAt урока, dueAt = +7 дней (LES-13).
// Показывается при входе в кабинет, без cron (D-005). На статус «пройден» не влияет.
model DeferredQuizState {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  courseSlug String    @default("ai-basics")
  lessonId   String
  dueAt      DateTime
  answeredAt DateTime?
  answers    Json?
  score      Int?

  @@unique([userId, courseSlug, lessonId])
  @@index([userId, dueAt, answeredAt]) // выборка «должные и несданные» при входе (CAB-04)
}

// Мини-проект. Каждая пересдача = новая строка (D-016); текущая = max(attempt).
model Submission {
  id           String           @id @default(cuid())
  userId       String
  user         User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  courseSlug   String           @default("ai-basics")
  attempt      Int
  status       SubmissionStatus @default(DRAFT)
  // 7 полей отчёта (PROJ-01):
  task         String? // задача
  tool         String? // инструмент
  prompt       String? // запрос
  result       String? // результат
  refined      String? // что уточнил
  verified     String? // как проверил
  application  String? // где применит
  adminComment String? // обязателен при NEEDS_CHANGES (ADM-06)
  reviewedById String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt // для optimistic concurrency (ADM-07)
  submittedAt  DateTime?
  reviewedAt   DateTime?

  @@unique([userId, courseSlug, attempt])
}

// Переживает GDPR-удаление владельца в обезличенном виде (D-010, CERT-07).
model Certificate {
  id         String            @id @default(cuid())
  number     String            @unique // CRAT-2026-0001 (CERT-03)
  userId     String?
  user       User?             @relation(fields: [userId], references: [id], onDelete: SetNull)
  fullName   String?           // снапшот ФИО на момент выдачи; null после GDPR-удаления
  courseSlug String            @default("ai-basics")
  courseTitle String           // снапшот названия курса
  status     CertificateStatus @default(VALID)
  issuedAt   DateTime          @default(now())
  revokedAt  DateTime?
}

// Счётчик номеров сертификатов по годам; берётся SELECT ... FOR UPDATE в транзакции выдачи.
model CertificateCounter {
  year    Int @id
  counter Int @default(0)
}

model EmailLog {
  id        String      @id @default(cuid())
  toEmail   String
  userId    String?
  user      User?       @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      EmailType
  subject   String
  payload   Json        // данные для рендера письма — нужны для ручной переотправки (ADM-08)
  status    EmailStatus @default(QUEUED)
  attempts  Int         @default(0)
  lastError String?
  resendId  String?     // id сообщения у Resend
  createdAt DateTime    @default(now())
  sentAt    DateTime?

  @@index([status, createdAt])
}

// Лимиты T1 в базе — переживают рестарт, это деньги Anthropic API (D-015, TRN-03).
model TrainerUsage {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  trainerId String   // "t1"
  usedAt    DateTime @default(now())

  @@index([userId, trainerId, usedAt]) // ≤20/день (Warsaw) и ≤3/мин — count по окнам
}
```

## Пояснения к неочевидным местам

**Почему нет таблицы sessions.** Сессия — подписанная httpOnly cookie (D-008). Пользователь читается из базы на каждый запрос: удалённый (GDPR) пользователь автоматически теряет доступ, роль админа проверяется по `ADMIN_EMAILS` на каждый админ-запрос (AUTH-10).

**Registration vs User.** Заявка ≠ учётка. `User` создаётся только в момент «выдать доступ» (ADM-03): в базе не копятся полупустые пользователи, а email остаётся единственным ключом связи заявки, согласий и будущей учётки.

**Consent по email, append-only.** Согласие даётся на форме регистрации, когда `User` ещё не существует, поэтому ключ — email. История никогда не переписывается: отзыв = новая запись `granted=false`. «Действующее согласие» = последняя запись пары (email, type). CSV-экспорт (ADM-09) фильтрует по этому правилу.

**Судьба записей при GDPR-удалении (ADM-10):**

| Таблица | Действие |
|---|---|
| User, Registration, Consent, Enrollment, LessonProgress, QuizResult, DeferredQuizState, Submission, EmailLog, MagicLink, TrainerUsage | удаляются (cascade / по email) |
| Certificate | остаётся: `userId → null`, `fullName → null`, `status → REVOKED`, `revokedAt` |
| CertificateCounter | не трогается — номер не переиспользуется (CERT-03) |

**Номер сертификата без гонок.** Выдача — одна транзакция: `SELECT … FOR UPDATE` строки `CertificateCounter` за текущий год (Warsaw), `counter+1`, формирование `CRAT-{год}-{counter:4}`, вставка Certificate. Два одновременных триггера выдачи получат разные номера; повторная выдача исключается уникальностью «один VALID сертификат на (userId, courseSlug)» — проверяется в той же транзакции.

**QuizResult.answers как Json.** Ответы пишутся по мере прохождения (после каждого вопроса — LES-07), поэтому брошенный квиз сохраняет частичные ответы для аналитики, но попытка без `finishedAt` нигде не учитывается.
