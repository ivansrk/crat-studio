# Ф5-дизайн «Визуальная система CRAT» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Натянуть визуальную систему CRAT (docs/design-brief.md — источник правды) на существующую архитектуру: новая главная-«редакционный монтаж» с направлениями/командой/контактами, лендинг курса, кабинет-«горизонт», квиз-«прожектор», тихая тёмная админка — БЕЗ изменения бизнес-логики, контрактов, auth и тестов.

**Architecture:** Слои: (1) токены+utility-классы crat-* + CSS-анимации; (2) общие компоненты components/site/ (Header/Footer/HeroVisual/карточки); (3) тексты ru.ts (финальные, из брифа §11–12); (4) страницы. Всё CSS-only (без Tailwind/Framer Motion — D-030). Каждая задача обязана оставлять зелёными: typecheck / lint / test (94) / build.

**Спеки:** docs/design-brief.md (§1–14) · requirements SITE-01…09, UX-01…08 · D-030 · чеклист брифа §14.

**Запреты исполнителям (бриф §13):** не трогать Prisma/auth/lib-логику/контент-контракт; без белого фона; без англ. UI-строк; без стоков; без новых зависимостей; кириллица только через t.

---

### Task 1: Фундамент — токены, utility-классы, анимации

**Files:** Modify `lib/design/tokens.css`; Create `lib/design/crat.css` (+@import в globals.css ПОСЛЕ tokens)

- [ ] Токены: добавить из брифа §4 (bg-black, bg-void, red-blood, red-dark, cyan-faded, violet-shadow, paper-muted, line-soft, line-red). Существующие НЕ менять.
- [ ] `lib/design/crat.css` — utility-система (полные реализации, бриф §6):
  - `.crat-shell` (max-width 76rem, авто-поля, padding) — широкая обёртка секций главной; НЕ трогает глобальный `main` (страницы контента остаются 46rem);
  - `.crat-section` (вертикальные отступы clamp(4rem,10vh,7rem));
  - `.crat-kicker` (JetBrains Mono, uppercase, letter-spacing .18em, размер 0.78rem→НЕТ, мелкий текст запрещён: 0.89rem/17px minimum — использовать var(--fs-small), цвет paper-muted);
  - `.crat-display` (Cormorant, clamp(2.4rem,6vw,4.2rem), line-height 1.05);
  - `.crat-muted` (paper-muted);
  - `.crat-button` (базовая: paper-текст на ink-фоне, 1px line-soft граница, padding 1rem 1.9rem, radius 10px, font inherit, transition; hover: border line-red + box-shadow neon-glow; focus-visible outline neon) + `.crat-button.primary` (граница neon, glow постоянный слабый) + `.crat-button.secondary` (прозрачный фон);
  - `.crat-card` (фон color-mix(paper 4%, transparent), граница line-soft, radius 14px, padding 2rem; hover: translateY(-4px) + граница line-red; transition 0.35s);
  - `.crat-grid` (grid, gap 1.5rem, minmax 260px auto-fit) и `.crat-grid.cols-4` (на desktop 4);
  - `.crat-visual-frame` (тёмный «киноэкран»: фон radial-gradient красного свечения на bg-void, aspect-ratio 16/9, radius 14px, overflow hidden, position relative) + модификаторы `.horizon` (линейный градиент red-dark→bg-void с красной линией-горизонтом), `.spot-mint` (радиальное пятно mint 12%), `.neon-line` (::after — тонкая neon-линия с glow);
  - `.crat-noise` (::before, повторяющийся SVG-noise data-URI, opacity .06, pointer-events none) — зерно;
  - `.crat-red-line` (width 3.5rem, height 2px, фон neon, box-shadow neon-glow);
  - `.crat-tag` (mono, uppercase, размер fs-small, цвет lavender, before '[' after ']');
  - анимации: `.fade-up` (@keyframes fadeUp: opacity 0/translateY(14px) → 1/0; animation .7s ease-out both; с `animation-delay` через `.d1/.d2/.d3` +120ms шаг), `.red-glow` (пульс тени 3.2s), `.reveal-line` (underline-reveal для ссылок: background-size transition), `.cinematic-card` (медленный zoom фона на hover 6s);
  - prefers-reduced-motion — уже глушится глобально, не дублировать.
- [ ] Ссылки-навигация: `.crat-nav a` — без подчёркивания, reveal-line на hover, красный underline.
- [ ] Проверки + Commit `"Ф5: токены-расширение и utility-система crat-* (бриф §4–6)"` (+трейлер Co-Authored-By: Claude Fable 5 <noreply@anthropic.com> — во всех коммитах).

---

### Task 2: Тексты ru.ts (бриф §11–12 дословно)

**Files:** Modify `lib/i18n/ru.ts`

- [ ] Обновить/добавить разделы: `home` (brand, label, heroTitle, heroSubtitle, primaryCta, secondaryCta, directionsTitle, education/automation/creative Title+Text, courseFocusTitle 'Первый курс', courseFacts-шаблон НЕ хардкодить числа — соберётся на странице из contentа, courseCta 'Открыть программу', automationSectionTitle/Text, automationCards: 4 строки, automationCta 'Обсудить задачу', creativeSectionTitle/Text, ethicsTitle 'Границы и этика', ethicsText, processTitle + processSteps: 4 строки, teamTitle, teamSubtitle, expTitle, expText, expFacts: 4 строки, contactTitle, contactText, contactCourseCta 'Оставить заявку на курс', contactProjectCta 'Обсудить проект', toCabinet — уже есть).
- [ ] `team`: массив из 4 объектов {num, name, role, text, tags[]} — §11 брифа дословно, БЕЗ Валерии Таран.
- [ ] `landing`: обновить значения (courseLabel, heroSubtitle, forWhom, result, projectTitle 'Мини-проект и сертификат', projectText, acceptedBody) — §12; существующие ключи форм/ошибок не трогать.
- [ ] `footer`: tagline, directions, contactEmail 'edu@skld.me', nav-строки (navCourses 'Курсы', navAutomation 'Автоматизации', navStudio 'Студия', navTeam 'Команда', login 'Войти').
- [ ] `header`: sub 'applied AI / education / automation / creative work' (латиница-моно допустима как графический маркер бренда — зафиксировано в брифе §5; НЕ пользовательская строка-действие).
- [ ] Проверки (typecheck ловит все использования) + Commit `"Ф5: тексты CRAT — hero, направления, команда, футер (бриф §11–12, SITE-05)"`.

---

### Task 3: SiteHeader + SiteFooter на все публичные страницы

**Files:** Create `components/site/SiteHeader.tsx`, `components/site/SiteFooter.tsx`; Modify `app/layout.tsx` (или локально по страницам — см. ниже), `components/site.css`

- [ ] Header: sticky, фон color-mix(bg-deep 82%, transparent) + backdrop-blur 8px, нижняя граница line-soft; слева brand (ссылка /) + `.crat-kicker`-подпись; справа `.crat-nav`: Курсы /#course · Автоматизации /#automation · Студия /#studio · Команда /#team · [Войти /login | В кабинет /app] (по currentUser — Header серверный, зовёт currentUser()).
- [ ] Footer: brand, tagline, directions-строка, nav-колонка, mailto contactEmail. Тихий, line-soft разделитель.
- [ ] РАЗМЕЩЕНИЕ: НЕ в корневом layout (админка/кабинет имеют свои шапки-контексты; /health — служебная). Вставить Header+Footer явно на публичные страницы: `/`, `/ai-basics`, `/ai-basics/accepted`, `/register`, `/login`(+sent/invalid), `/cert/[number]` (Ф3 позже сам возьмёт), `/unsubscribe/[token]`. Мобайл: nav переносится под brand (flex-wrap), без бургера (5 ссылок помещаются) — проверить на 360px.
- [ ] Проверки + smoke (dev: шапка на / и /login; НЕТ на /app и /admin) + Commit `"Ф5: SiteHeader/SiteFooter на публичных страницах (SITE-07)"`.

---

### Task 4: Главная `/` — редакционный монтаж (бриф §7)

**Files:** Rewrite `app/page.tsx`; Create `components/site/{HeroVisual,SectionLabel,DirectionCard,TeamCard}.tsx`; Modify `components/site.css`

- [ ] Секции по брифу §7 (все 12 пунктов): hero (kicker → crat-display → subtitle → 2 CTA → HeroVisual: crat-visual-frame + noise + neon-line, fade-up каскад); направления (3 DirectionCard: номер-моно 01/02/03, kicker, заголовок, текст, crat-red-line); курс в фокусе id=course (заголовок courseFocusTitle, crat-card: getContent().course.title + факты «{modules.length} модуля / {lessonCount()} уроков / мини-проект / сертификат» строкой из данных, courseCta → /ai-basics); автоматизации id=automation (4 compact crat-card из automationCards, CTA → /#contact); студия id=studio (creativeSection + асимметричная сетка из 4 crat-visual-frame с разными модификаторами horizon/spot-mint/neon-line/noise); этика (crat-card с ethicsText); процесс (4 монтажные карточки-кадра: номер + шаг); команда id=team (teamTitle/Subtitle + 4 TeamCard: номер, CSS-плейсхолдер-кадр, имя, роль, текст, crat-tag'и); опыт (expTitle/Text + 4 факта в mono-строках); контакты id=contact (contactTitle/Text + 2 кнопки: /ai-basics#signup и mailto).
- [ ] SITE-04: при сессии — «В кабинет» видна (в Header; hero-CTA не меняются).
- [ ] Обёртки: `.crat-shell`/`.crat-section` (НЕ узкий main) — страница использует свой контейнер, НЕ глобальный `main{max-width:46rem}`: рендерить без `<main className>`-конфликта — использовать `<main className="crat-home">` и в CSS `main.crat-home { max-width: none; padding: 0; }`.
- [ ] Проверки: build + dev-smoke (все секции, якоря работают, мобайл 360px, no белый фон) + Commit `"Ф5: главная — редакционный монтаж CRAT (SITE-01/07/08/09, бриф §7)"`.

---

### Task 5: Лендинг `/ai-basics` + формы (бриф §8)

**Files:** Modify `app/ai-basics/page.tsx`, `app/ai-basics/accepted/page.tsx`, `app/register/page.tsx`, `components/signup-form.tsx`, `components/site.css`

- [ ] Hero: kicker courseLabel → crat-display title из course.yaml → heroSubtitle → CTA #signup/В кабинет. Секции: «Для кого» (forWhom), «Программа» (модули как crat-card с mono-номерами уроков — данные как сейчас), «Результат» (result), «Мини-проект и сертификат» (projectText). Header/Footer уже с Task 3.
- [ ] Форма: тёмная crat-card, поля крупные (уже), focus — красный контур (есть с Ф1 — унифицировать под .crat-button/crat-инпуты), чекбоксы крупные, кнопка .crat-button.primary. accepted-страница — карточка-подтверждение в стиле.
- [ ] Проверки (в т.ч. форма отправляется, notices рендерятся) + Commit `"Ф5: лендинг курса и формы в системе CRAT (SITE-02/06, бриф §8)"`.

---

### Task 6: Кабинет-«горизонт», квиз-«прожектор», вход (бриф §9)

**Files:** Modify `app/app/page.tsx` (только разметка/классы), `components/cabinet.css`, `components/quiz.css`, `app/login/*.tsx`, `app/app/lessons/[lessonId]/page.tsx` (классы), `lib/i18n/ru.ts` (если нужны подписи «Модуль N»)

- [ ] Кабинет: прогресс — «линия горизонта»: горизонтальная полоса, над ней 4 «здания»-блока (CSS: тёмные прямоугольники разной высоты с neon-«вывесками» — названиями модулей в mono; пройденный модуль — вывеска светится red-glow, текущий — пульс), фигурка-точка на линии по pct (существующая логика позиции). Список уроков — карточная структура (crat-card на модуль, уроки строками со статус-label mono). Миссия — crat-card. Логика/данные не трогать.
- [ ] Квиз: «сцена с прожектором» — фон страницы bg-void, вопрос в световом «пятне» (radial-gradient paper 6% за вопросом), варианты — crat-card кнопки; фидбек-блоки в текущей логике. Не менять действия/формы.
- [ ] Вход/sent/invalid + accepted: карточки, kicker, кнопки системы.
- [ ] Урок: заголовки/кнопки/шпаргалка уже на mdx-классах — заменить кнопочные классы на .crat-button, компоненты MDX не трогать.
- [ ] Проверки + Commit `"Ф5: кабинет-горизонт, квиз-прожектор, страницы входа (UX-05, бриф §9)"`.

---

### Task 7: Админка-стиль + финальный прогон + чеклист брифа

**Files:** Modify `components/admin.css`, при необходимости admin-страницы (только классы)

- [ ] Админка: тёмные таблицы построже (thead mono-uppercase, line-soft границы), кнопки .crat-button (danger-действия — граница red-blood), баннеры едины. Функции не трогать (бриф §10).
- [ ] Финальный прогон: typecheck / lint / test (94) / build.
- [ ] Чеклист брифа §14 dev-сервером: / — CRAT-студия (не список уроков); /ai-basics — программа из course.yaml; #signup работает; SITE-04-ветка; /app гейт жив; /health жив; нет белого фона (grep #fff/white по css); мобайл 360px читаем; нет англ. UI-строк (grep). Вывод — в отчёт.
- [ ] Commit `"Ф5: админка в системе CRAT + финальная проверка чеклиста брифа"`.

---

## Self-review
- Бриф §7 — все 12 блоков в Task 4; §8 → T5; §9 → T6; §10 → T7; §11–12 → T2; §4–6 → T1; header/footer → T3. SITE-07/08/09 покрыты; SITE-01…06 сохранены (программа из course.yaml, #signup, SITE-04, тексты через t).
- Не трогаем: lib/(auth|progress|cert|project|email|content|registration|admin), prisma, контент, тесты. Единственные ts-правки — страницы/компоненты/ru.ts.
- Порядок: T1→T2→T3→T4→T5→T6→T7 (T4 зависит от T1–T3).
