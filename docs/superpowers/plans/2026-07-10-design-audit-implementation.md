# Внедрение тройного дизайн-аудита — Implementation Plan

> Источник: docs/design-audit-2026-07-10.md (утверждён Иваном «давай делай»). REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Каждый исполнитель ОБЯЗАН прочитать .claude/skills/crat-design/SKILL.md и следовать скриншот-процессу. Ветка: design-audit. Порядок: T1→T2→T3 (движение) → T4→T5 (кабинет) → T6→T7 (публичка) → T8 (админка/служебные) → T9 (финал). Блок-ревью после T3, T5, T8; финал-ревью после T9.

**Общие правила:** строки — ru.ts с [текст на согласование] для новых пользовательских; prefers-reduced-motion уважать (CSS — глобальный глушитель, canvas — вручную speed 0); шейдеры — только @paper-design/shaders-react по образцу HeroShader.tsx (dynamic ssr:false, useSyncExternalStore, aria-hidden, scrim); гейты typecheck/lint/test/build на каждой задаче; коммит — трейлер Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>. «Сейчас в работе» (П3, нужны факты Ивана) — НЕ в этом плане.

### T1: Motion-санация и отклики (Пакет А.1, А.8)
**Files:** lib/design/crat.css, components/site.css, components/cabinet.css, lib/design/animations/{animations.css,registry.ts}, docs/content-format.md (реестр анимаций — убрать float-up из списка)
- [ ] `.crat-button`: `:active { transform: scale(.97) }`, transform-переход 160ms cubic-bezier(.23,1,.32,1); ховеры .3–.35s → .18–.2s с той же кривой (кнопки, крат-карточки, underline-reveal nav/ссылок, чекбоксы 150ms); .crat-card:hover под @media(hover:hover).
- [ ] Санация: `.progress-figure` transition left — удалить; `redGlowPulse` → разовый «розжиг» 900ms on load (animation без infinite); `heroGlowShift` → transform: translateX на растянутом псевдоэлементе (GPU); `.anim-float-up` удалить из animations.css + registry.ts (+ упоминание в content-format, аддитивно-совместимо: неизвестный animationId уже даёт warning — проверить, что валидация не падает, а контент 1.1 его не использует; если использует — заменить в content на neon-pulse); `.anim-neon-pulse` 2.4s → 4s; fadeUp кривая → cubic-bezier(.23,1,.32,1), задержки .08/.16/.24.
- [ ] Гейты + скриншот-смоук главной/кабинета. Commit «Дизайн-аудит T1: отклики нажатий, быстрые ховеры, санация вечных анимаций».

### T2: Шейдеры-эхо (Пакет А.2, А.3, А.7)
**Files:** Create components/site/SectionShader.tsx (обобщение HeroShader: props preset/colors/speed/intensity/scrim); Modify app/page.tsx (#contact), app/ai-basics/page.tsx (hero-текст), app/consult/page.tsx, app/app/[courseSlug]/lessons/[lessonId]/quiz/page.tsx (экран «сдан»), блок сертификата (кабинет-курс, T5 доделает разметку — здесь подготовить компонент CelebrationRays), app/cert/[number]/page.tsx; components/site.css
- [ ] SectionShader: один клиентский компонент, варианты: GrainGradient(ripple|blob) и GodRays(linear) — фактические импорты сверить с node_modules/@paper-design/shaders-react/dist/index.d.ts.
- [ ] Контакты главной: ripple #c6240c/#193829, colorBack #0d0d0d, intensity .08, speed .5, scrim под текст. /consult: blob #B11212/#193829, полосой за заголовком, не за формой. /ai-basics: Dithering ripple за текстовой половиной hero (фото не трогать!), speed .2. Квиз-финал и /cert: GodRays linear, colors красный .5/лайм .25, bloom .4, speed .6, за заголовком.
- [ ] Все — тише героя; между собой на одной странице не сочетать (кроме hero+contacts — не в одном вьюпорте). Reduced-motion: speed 0. Вес: проверить bundle-влияние (компоненты уже в зависимости).
- [ ] Гейты + скриншоты каждой точки. Commit «Дизайн-аудит T2: шейдеры-эхо — контакты, консультация, лендинг, прожектор-лучи».

### T3: Микро-интеракции (Пакет А.4–А.6)
**Files:** components/quiz.css + quiz/page.tsx (классы), components/cabinet.css, lib/design/crat.css (чекбокс), components/site.css (view()-вход секций, статьи, cookie), components/CookieBanner.tsx
- [ ] Квиз: варианты fadeUp 8px 250ms stagger nth-child 40ms; фидбек-aside fade+translateY 200ms; спотлайт opacity 400ms.
- [ ] Прогресс-линия горизонта: span scaleX(0→var(--p)) 600ms on load (создать основу — T5 достроит визуал линии; здесь keyframe+span).
- [ ] Чекбокс checked::after scale(.6)→1 180ms. Cookie-баннер: translateY(100%)→0 320ms cubic-bezier(.32,.72,0,1) (@starting-style + fallback). Статьи: кинозум обложек из .cinematic-card (6s, hover:hover) + underline 200ms.
- [ ] Вход секций публички: @supports (animation-timeline: view()) — fadeUp контейнера секции, animation-range entry 0% cover 20%; без поддержки — просто видимый контент.
- [ ] Гейты + живой прогон квиза (seed student, БД 51214). Блок-ревью T1–T3 (спек+качество, скриншоты, reduced-motion пробы). Commit «Дизайн-аудит T3: сцена квиза, награды, входы секций».

### T4: Кабинет — структура (Пакет В.1, В.2, В.8, В.9-часть)
**Files:** app/app/layout.tsx (+ создать components/site/CabinetHeader.tsx), lib/i18n/ru.ts, app/app/page.tsx, app/app/[courseSlug]/page.tsx, app/app/[courseSlug]/lessons/[lessonId]/page.tsx, components/CookieBanner.tsx (или layout-условие), components/cabinet.css
- [ ] CabinetHeader: компактный (лого-штамп 44px → /app, название курса при наличии, «Аккаунт», «Выйти») — в app/app/layout.tsx; на странице урока — + позиция «Урок N из M · Модуль K» и prev/next ссылки (nextLessonId есть; prev — вычислить).
- [ ] ru.ts: finishLesson → «Пройти квиз ({N} вопроса)» — посмотреть фактическое N из quiz.yaml (3) — строка с плейсхолдером.
- [ ] Убрать дубли Тренажёры/Консультация с /app/[courseSlug] (остаются на хабе); «Демо-курс СКОРО» — в конец хаба; миссия на уроке — только если пустая; куки-баннер скрыть в /app и /admin (layout-пропом или pathname в клиенте).
- [ ] Гейты + скриншоты кабинета 360/1440. Commit «Дизайн-аудит T4: оболочка кабинета, честная кнопка квиза, чистка дублей».

### T5: Кабинет — горизонт, квиз-сцена, сертификат-триумф (Пакет В.3–В.7, В.10)
**Files:** components/cabinet.css, components/quiz.css, app/app/[courseSlug]/page.tsx, quiz/page.tsx, app/app/page.tsx (статусы), app/cert/[number]/page.tsx, components/mdx/Callout.tsx + mdx.css, scripts/seed.ts (+Certificate), lib/i18n/ru.ts, components/site.css (печать-штамп .crat-stamp)
- [ ] Горизонт: красная линия прогресса (T3-основа) + окна-сетка зданий (repeating-linear-gradient, у пройденных — neon-примесь, «зажжены»), точка света с glow вместо 🚶, красное небо за зданиями; вывеска «светится» ТОЛЬКО у завершённых модулей; 360 — горизонтальная полоса с 4 засечками вместо коробок.
- [ ] Квиз: пятно 12–14% + конус вверх, виньетка inset, вопрос Cormorant clamp(1.8,3vw,2.4rem), «01 / 03» mono-kicker; двухшаговый ответ (radio выбор + кнопка «Ответить» — ВНИМАНИЕ: recordAnswer идемпотентен, но проверь UX формы; «Вернуться к уроку» ссылка); финал «Квиз сдан» + CelebrationRays (T2) + печать.
- [ ] Печать-штамп .crat-stamp (CSS: рамка 1px, mono «CRAT · STUDIO», rotate(-5deg), opacity .6, radial-маска «непропечатанности») — на /ai-basics/accepted, финале квиза, сертификате, футере.
- [ ] Сертификат-триумф: на хабе и странице курса статусы «проект на проверке» → «сертификат готов»; блок сертификата = кремовый документ (--paper фон, имя Cormorant, номер mono, двойная рамка, печать) + кнопки; /cert/[number] валидный — тот же документ + строка «Действителен»; чек-лист урока «квиз ✓ / практика ☐» под заголовком (mono, мята=сделано).
- [ ] Дезэмодзификация: Callout.tsx 💡⚠️🧭 → mono-лейблы [ИДЕЯ]/[ВНИМАНИЕ]/[ПРИМЕР] цветом рамки (ru.ts); 🎉 (урок, проект) → «УРОК ПРОЙДЕН»/«ПРОЕКТ ОТПРАВЛЕН» с мятной чертой; «нужны правки» → alert-карточка с красной линией на курсе и хабе + подсветка пустого поля проекта (admin-комментарий уже указывает номер? добавить нумерацию полей в форму проекта — mono 01–07).
- [ ] seed: выданный Certificate дипломанту (идемпотентно, номер из счётчика) — /cert и PDF проверяемы смоуком; тренажёр t1: строка «осталось N из 20 сегодня» (лимит из lib/trainers/limits — счётчик читается дёшево), «модель отвечает…» в pending-состоянии формы, пример запроса в пустом состоянии (ru.ts).
- [ ] /reset битый токен → «недействительна или устарела»; аккаунт: email юзера + подсказка «минимум 8 символов». Гейты + живые прогоны (student и diplomant). Блок-ревью T4–T5. Commit «Дизайн-аудит T5: горизонт, сцена квиза, сертификат-документ, печать CRAT».

### T6: Главная — монтаж и типографика (Пакет Б.1–Б.5, Б.9, Б.11)
**Files:** app/page.tsx, components/site.css, lib/design/crat.css, lib/design/tokens.css (--fs-h3), app/fonts.ts (italic), app/globals.css (::selection, scrollbar), lib/i18n/ru.ts
- [ ] Типогигиена: .crat-display text-wrap balance; .section-intro pretty; ::selection red-dark/paper; тонкий тёмный scrollbar; --fs-h3 clamp(1.6,2.5vw,2.1) — имена команды, заголовки модулей; Cormorant italic в fonts.ts + .crat-em (лид статьи — T7).
- [ ] Kickers: снять SectionLabel у Этики/Процесса/Команды/Опыта/Контактов (заголовки остаются).
- [ ] «Этика» → full-bleed манифест: radial red-dark→bg-void, текст ethicsText крупным Cormorant (первая фраза манифестом 1.9–2.4rem ≤30ch — вытащить «ИИ не заменяет человека…» строку в отдельный ключ), без crat-card.
- [ ] «Курс в фокусе» → киноафиша 3fr/2fr: слева заголовок+факты+CTA, справа full-height кадр hero-course.webp с горизонтом и зерном.
- [ ] «Автоматизации»: 4 карточки → mono-список с display-цифрами Cormorant (opacity .3); «Процесс» → линейка на красной линии, 4 кадра с display-цифрами; studio-grid → full-bleed + фон green-night градиент + лаймовый горизонт на всю ширину.
- [ ] Ссылки списка уроков кабинета: paper + underline-reveal (курсовая страница — да, это Пакет Б.9, файл app/app/[courseSlug]/page.tsx — координация с T5: T6 идёт ПОСЛЕ, конфликт малый — только цвет ссылок).
- [ ] Семантика: mdx-callout-warning → красная рамка, idea → мята (mdx.css, координация с T5-лейблами).
- [ ] Гейты + скриншоты 4 ширины. Commit «Дизайн-аудит T6: манифест, киноафиша, монтаж секций, типогигиена».

### T7: Лендинг и фирменные детали (Пакет Б.6, Б.8, Б.10-часть)
**Files:** app/ai-basics/page.tsx, components/site.css, app/articles/[slug]/page.tsx (лид italic), content/ai-basics (НЕ трогать — цитату захардкодить в ru.ts со ссылкой на урок? НЕТ: взять первые строки реального урока 1.1 через getLesson — статично при билде), components/mdx (подписи кадров), app/login/page.tsx + reset (вертикальный кадр)
- [ ] «Выдержка из урока» на /ai-basics: цитата из урока 1.1 (2–3 предложения, отрендерить как текст в crat-visual-frame + noise, mono-подпись [УРОК 1.1 / название]) между Программой и Результатом; «Результат»+«Мини-проект» — один разворот 2 колонки.
- [ ] Перфорация киноплёнки (repeating-linear-gradient, 14px) — после направлений и перед контактами главной; красный горизонт над футером (тонкая линия+glow по всей ширине).
- [ ] Mono-подписи под studio-кадрами и обложками статей (ru.ts, честные: [РАСКАДРОВКА], [НЕОН], …); лид статьи — .crat-em italic; видео-заглушка урока → «экран до сеанса» (bg-void 16:9, тусклый горизонт, mono-надпись).
- [ ] /login и /reset: справа узкий вертикальный crat-visual-frame с красным горизонтом (CSS, десктоп only).
- [ ] Гейты + скриншоты. Commit «Дизайн-аудит T7: выдержка урока, перфорация, подписи кадров, экран-заглушка».

### T8: Админка и служебные (Пакет Г)
**Files:** Create app/not-found.tsx; Modify app/admin/students/page.tsx + [userId], app/admin/layout.tsx, components/admin.css, app/cert/[number]/page.tsx (не найден), app/unsubscribe/[token]/page.tsx, app/admin/GrantForm.tsx, app/admin/page.tsx (даты), app/admin/projects/*, app/admin/clients/[userId], app/admin/emails/page.tsx, lib/i18n/ru.ts, lib/crm или запросы (фильтр админов)
- [ ] app/not-found.tsx: тёмная сцена CRAT, «Такой страницы нет», ссылки главная/курс/кабинет (ru.ts).
- [ ] Удаление студента: из строк таблицы убрать → карточка студента, details-«Опасная зона», тёмный стилизованный input (глобальный стиль T-полей уже есть), полный placeholder; админы исключены из списков студентов/клиентов и из удаления (фильтр по isAdminEmail).
- [ ] Мобильная админка: .admin-table-wrap { overflow-x:auto } всем таблицам; admin-nav: aria-current (переиспользовать NavLink-паттерн) + «Выйти» + счётчики «Заявки (N)»/«Проекты (N)» (дешёвые count в layout).
- [ ] /cert не найден: формат CRAT-ГГГГ-NNNN, «проверьте опечатку», mailto; валидный — статус «Действителен» (+ документ-стиль из T5). /unsubscribe битый — mailto из словаря.
- [ ] GrantForm: кнопка «Скопировать» (clipboard, client); даты подачи у заявок /admin; карточка проекта → ссылка на студента; карточка клиента → его консультации; empty-state «Письма» с объяснением статусов.
- [ ] Гейты + скриншоты админки 360/1440 с сессией. Блок-ревью T6–T8. Commit «Дизайн-аудит T8: 404, безопасная админка, мобильные таблицы, счётчики».

### T9: Финал
- [ ] Полный прогон гейтов; скриншот-галерея всех страниц 360/1440; живой прогон: студент (урок→квиз→практика), дипломант (сертификат), админ (списки).
- [ ] Повторная impeccable-критика (dual-agent по протоколу) — тренд балла vs 23/40; результат в отчёт.
- [ ] Финал-ревью всей ветки (opus) → фиксы → мерж → CI → сводка Ивану + список [текст на согласование].
