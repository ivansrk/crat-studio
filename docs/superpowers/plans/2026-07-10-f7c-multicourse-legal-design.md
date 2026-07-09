# Ф7в «Мультикурс, юр-блок, дизайн-свет» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development или superpowers:executing-plans. TDD для чистых частей (реестр курсов, published-фильтр, редирект-маппинг). **Зависит от Ф7а** (вход по паролю в smoke) и не конфликтует с Ф7б (разные файлы, кроме `/app`-кабинета — координировать merge).

**Goal:** Несколько курсов из `content/` без правки кода (только контент + `published`); маршруты `/app/{courseSlug}/…` c 301 со старых; прогресс/проект/сертификат per-course; кабинет «Мои курсы» + каталог + блок консультаций; юр-страницы /privacy /terms /cookies + куки-баннер; русская навигация + edu@cratstudio.com; свет-слой CTA/рамки/hero/MUBI-кадры.

**Architecture:** `lib/content` становится реестром курсов: `getCourses(): CourseContent[]`, `getCourse(slug)`, существующие `getLesson(slug, id)`, `lessonCount(slug)`, `assetBase(slug, lesson)`, `nextLessonId(slug, id)` — slug-первым параметром. `lib/progress|project|cert` — константа `COURSE` уходит, `courseSlug` в сигнатурах (D-036). Единственная схема-правка: `QuizResult @@unique` +courseSlug. Юр-страницы — статические RSC c TODO-структурой; куки-баннер — крошечный client-component с localStorage (LEGAL-04). Свет-слой — только CSS в `lib/design/` (DSN-06).

**Спеки:** requirements §20 (MC), §22 (LEGAL), §23 (NAV/DSN); flows F19, E-MC1…3, E-LEG1; data-model «Пакет Ф7 §5»; D-036, D-037; phases Ф7в; дизайн-бриф §4/§6/§7.

**Правила исполнителям:** контракт course-factory (docs/content-format.md) НЕ менять — `published` добавляется как НЕобязательное поле course.yaml (отсутствует = published, обратная совместимость; согласование с фабрикой — аддитивно, зафиксировать в их DECISIONS по каналу Ивана); формат урока прежний; НА ПРОДЕ есть прогресс — все запросы после рефактора обязаны находить старые строки (`courseSlug='ai-basics'` дефолт в данных уже стоит); строки — ru.ts; CSS-only, prefers-reduced-motion.

---

### Task 1: lib/content — реестр курсов (MC-01/02/08, TDD)

**Files:** Modify `lib/content/index.ts`, `lib/content/loader.ts`, `lib/content/types.ts`, `lib/content/index.test.ts`; Create демо-курс `content/demo-course/` (course.yaml published:false + 1 модуль/1 урок-заглушка)

- [ ] types: `CourseContent` += `slug: string`, `published: boolean` (из course.yaml, default true при отсутствии поля).
- [ ] loader: `published` парсится; отсутствие — true.
- [ ] index: сканировать `content/*` (кроме `articles`), кэш на процесс `Map<slug, CourseContent>`; API:
  - `getCourses(): CourseContent[]` (все, включая unpublished — для каталога «Скоро»);
  - `getCourse(slug): CourseContent | null`;
  - `getLesson(slug, id)`, `lessonCount(slug)`, `nextLessonId(slug, id)`, `assetBase(slug, lesson)`, `contentErrors()` — по всем курсам.
- [ ] Обратная совместимость на время рефактора НЕ нужна — единый PR меняет всех вызывающих (Task 2/3); `getContent()` без аргумента удалить.
- [ ] TDD: демо-курс виден в getCourses, published=false; ai-basics published=true (без поля); lessonCount('ai-basics')=12; getLesson('demo-course','1.1') не путается с ai-basics '1.1' (E-MC2).
- [ ] `/health` и instrumentation-валидация — по всем курсам. Commit `"Ф7в: lib/content — реестр курсов, published-флаг, демо-курс (MC-01/02/08, D-036)"` (+трейлер Co-Authored-By: Claude Fable 5 <noreply@anthropic.com> — везде далее).

---

### Task 2: courseSlug в доменных модулях + фикс уникальности (MC-05/06)

**Files:** Modify `prisma/schema.prisma` (QuizResult @@unique), `lib/progress/index.ts`, `lib/progress/access.ts`, `lib/progress/deferred.ts`, `lib/project/index.ts`, `lib/cert/index.ts`, `lib/admin/resend-email.ts`

- [ ] Миграция: `QuizResult @@unique([userId, courseSlug, lessonId, attempt])` (было без courseSlug — латентный баг). Все строки `ai-basics` → дублей нет, пересоздание индекса безопасно. `prisma migrate dev --name f7c_quizresult_course_unique`.
- [ ] `lib/progress`: убрать `const COURSE`; `courseSlug` — первый/явный параметр `ensureProgress(userId, courseSlug, lessonId)` и далее по всем функциям; `getLesson`-проверки → `getLesson(courseSlug, id)`; запросы `where` везде с courseSlug (в т.ч. startAttempt/recordAnswer, где его не было).
- [ ] `lib/progress/deferred.ts`, `access.ts` (`hasCourseAccess(user, courseSlug)` — уже параметризован, убрать дефолт), `lib/project`, `lib/cert` (`isEligible(userId, courseSlug)`, `checkAndIssueCertificate(userId, courseSlug)`, lessonCount(courseSlug) — MC-06), `resend-email.ts` (сертификат по userId без хардкода slug — брать из EmailLog/поиска VALID любого курса; уточнить: искать по `log.userId` последний VALID).
- [ ] Триггер в recomputeCompletion передаёт courseSlug в checkAndIssueCertificate.
- [ ] Тесты обновить; typecheck ловит всех забытых вызывающих. Commit `"Ф7в: courseSlug в сигнатурах progress/project/cert + фикс unique QuizResult (MC-05/06)"`.

---

### Task 3: Маршруты /app/{courseSlug}/… + 301 (MC-04/07, E-MC1)

**Files:** Create `app/app/[courseSlug]/page.tsx` (страница курса), `app/app/[courseSlug]/lessons/[lessonId]/page.tsx`, `app/app/[courseSlug]/project/page.tsx`, `app/app/[courseSlug]/certificate/route.ts`; Modify старые `app/app/lessons/[lessonId]` и `app/app/project`, `app/app/certificate` → redirect; `app/actions/lesson.ts`, `quiz.ts`, `project.ts` (courseSlug в formData/параметрах)

- [ ] Новые роуты: проверка `getCourse(slug)` существует и published; `hasCourseAccess(user, slug)` (MC-07); контент/прогресс per-slug; переносится текущая разметка (логика не меняется).
- [ ] Старые роуты: `redirect('/app/ai-basics/lessons/'+id, 'permanent')` (E-MC1); аналогично /app/project и /app/certificate.
- [ ] actions: hidden `courseSlug` в формах; серверная валидация slug по getCourse + enrollment (не доверять форме).
- [ ] Квиз/ревью-страницы (`app/app/review`) — тем же образом.
- [ ] Commit `"Ф7в: курсо-зависимые маршруты + 301 со старых (MC-04/07)"`.

---

### Task 4: Кабинет — «Мои курсы», каталог, блок консультаций (MC-03, F19)

**Files:** Modify `app/app/page.tsx`, `lib/i18n/ru.ts`; (блок консультаций — форма из Ф7б Task 8; если Ф7б ещё не смержен — заглушка-ссылка на /consult)

- [ ] «Мои курсы»: enrollments юзера → карточки (title, прогресс N/lessonCount(slug), ссылка `/app/{slug}`); один курс — ведём сразу в него как раньше (не заставлять лишний клик — если enrollment один и каталог пуст, сохранить текущий вид).
- [ ] Каталог: `getCourses()` минус мои: published → карточка со ссылкой на лендинг/описание; unpublished → карточка «Скоро» без ссылки (E-MC3).
- [ ] Блок «Консультация по внедрению ИИ» (оффер: оптимизация / автоматизация / персональная система) — тексты ru.ts [текст на согласование].
- [ ] Deferred-блок (CAB-04) — по всем курсам юзера (deferred.ts уже параметризован в T2; выборка без фильтра курса, самый давний).
- [ ] Commit `"Ф7в: кабинет — мои курсы, каталог, оффер консультаций (MC-03)"`.

---

### Task 5: Юр-страницы + футер + куки-баннер (LEGAL-01…06)

**Files:** Create `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/cookies/page.tsx`, `components/CookieBanner.tsx` (client); Modify футер-компонент, `app/layout.tsx`, `lib/i18n/ru.ts`, форма регистрации (ссылки согласий — LEGAL-05)

- [ ] Три страницы: SSR, metadata (SEO-02), структура-заглушка с разделами и явными `TODO: текст от Ивана` (LEGAL-02, E-LEG1); тексты — ru.ts (legal.*), крупный кегль, стиль CRAT.
- [ ] Футер: ссылки /privacy /terms /cookies (LEGAL-03) на всех публичных страницах.
- [ ] CookieBanner (client, минимальный JS — LEGAL-04/06, D-037): информационный, фиксированная полоса снизу — текст + ссылка /cookies + кнопка «Понятно»; `localStorage.crat_cookie_ack='1'`; до hydration не мигает (рендерить скрытым, показывать эффектом); prefers-reduced-motion — без анимации появления.
- [ ] Чекбокс политики в формах регистрации ссылается на /privacy и /terms (LEGAL-05).
- [ ] Обновить UX-07-поведение: баннер есть, но Plausible остаётся cookieless (никаких новых куки).
- [ ] Commit `"Ф7в: юр-страницы с TODO-структурой, футер, информационный куки-баннер (LEGAL-01…06, D-037)"`.

---

### Task 6: Русская навигация + контактный email (NAV-01/02)

**Files:** Modify `lib/i18n/ru.ts`, header-компонент, `docs/design-brief.md` (адаптация §7.1), `DECISIONS.md` (отметка в D-030 — email сменён)

- [ ] Header: mono-кикер «applied AI / education / automation / creative work» → русский вариант (черновик: «прикладной ИИ / обучение / автоматизации / креатив» — [текст на согласование]); nav-подписи проверить: Курсы · Автоматизации · Студия · Команда · Войти (уже русские — сверить фактический код).
- [ ] Прочесать ВСЕ публичные строки на английский (кроме бренд-имени CRAT studio и mono-тегов команды [education] и т.п. — теги решением дизайн-брифа §11 остаются? НЕТ: NAV-01 требует навигацию; теги команды — контент брифа, оставить, зафиксировать в отчёте).
- [ ] `t.footer.contactEmail`: `edu@skld.me` → `edu@cratstudio.com`; пока ящик не заведён — оставить старый в env-независимом словаре НЕЛЬЗЯ потерять письма: сделать значение и пометку «временно skld» удалять только после подтверждения Ивана, что ящик работает (зависимость phases Ф7в). Обновить D-030-отметку.
- [ ] Commit `"Ф7в: русская навигация, контактный email cratstudio.com (NAV-01/02, D-037)"`.

---

### Task 7: Дизайн-свет (DSN-01…06)

**Files:** Modify `lib/design/crat.css` (или где живут utility-классы), `app/globals.css`; точечные правки классов в `app/page.tsx`, `app/ai-basics/page.tsx`

- [ ] `.crat-button.primary` — свечение (референс wolfai.be): слоёные box-shadow (`0 0 0 1px line-red, 0 0 24px rgba(255,75,58,.45), 0 0 64px rgba(255,75,58,.25)`), лёгкий радиальный ::before-глоу, hover-bloom (интенсивнее тени + лёгкий scale ≤1.02); токены из брифа §4, не новые цвета (DSN-01).
- [ ] `.crat-frame-gradient`: тонкая градиентная рамка (border-image или обёртка с padding 1px + linear-gradient через line-red→transparent) для hero visual frame и постеров (DSN-02).
- [ ] Hero: медленный градиентный сдвиг (`@keyframes` background-position, 30–60s, linear infinite) на свечении/фоне hero (DSN-03).
- [ ] MUBI-кадры: секции главной — полноширинные «кадры» (min-height, крупные заголовки, больше воздуха; только CSS-классы, разметка секций не меняется) (DSN-04).
- [ ] `@media (prefers-reduced-motion: reduce)`: глушить keyframes-сдвиг и hover-bloom-transition (DSN-05); зерно/контраст не ломают читаемость (UX-01).
- [ ] Прогнать все публичные страницы + кабинет визуально; никакого белого фона/мелкого кегля. Commit `"Ф7в: свет-слой — glow CTA, градиентные рамки, slow-gradient hero, кадры (DSN-01…06)"`.

---

### Task 8: seed v5 + финальный прогон

**Files:** Modify `scripts/seed.ts`, `docs/seed.md`

- [ ] seed: enrollment seed-студента на демо-курс НЕ нужен (курс unpublished — «Скоро» в каталоге проверяется без него); опц. второй enrollment для проверки «Мои курсы» — включить demo published в seed-инструкции? Нет: не менять контент из seed. Достаточно существующих юзеров + каталога.
- [ ] docs/seed.md — раздел Ф7в (что смотреть: каталог, «Скоро», старые URL редиректят).
- [ ] Финальный прогон: typecheck/lint/test/build; прогресс seed-студента по ai-basics НЕ потерян после рефактора (главный риск фазы — проверить руками N/12 в кабинете); старые URL 301; /health зелёный по обоим курсам. Commit `"Ф7в: seed v5 + прогон мультикурса"`.

---

## Внешние шаги Ивана (закрытие Ф7в)
1. Тексты /privacy, /terms, /cookies (до них — TODO-заглушки, не блокирует деплой).
2. Завести ящик edu@cratstudio.com → подтвердить смену в словаре.
3. Утвердить русские формулировки кикера навигации и оффера консультаций.
4. Приёмка визуала свет-слоя.
5. (Опц.) второй реальный курс от course-factory; согласовать с фабрикой аддитивное поле `published` в course.yaml.
6. Smoke-чеклист Ф7в из phases.md (6 шагов).

## Self-review
- MC-01…08: реестр (T1), сигнатуры+unique (T2), маршруты+301 (T3), кабинет/каталог (T4). Сертификат per-course lessonCount (T2, MC-06).
- LEGAL-01…06 (T5), NAV-01/02 (T6), DSN-01…06 (T7).
- Данные на проде: T2 не мигрирует строки (все ai-basics), только индекс; T8 проверяет живой прогресс.
- Контракт фабрики: published — аддитивно-необязательное, формат урока не тронут (T1).
- Порядок: T1→T2→T3→T4 (учебное ядро) → T5/T6/T7 (независимы, можно параллельно) → T8.
