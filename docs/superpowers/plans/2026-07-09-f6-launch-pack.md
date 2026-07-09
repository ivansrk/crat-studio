# Ф6 «Запуск-пакет: статьи + полный SEO/GEO» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Раздел /articles на том же MDX-движке (статья = файл в git, ART-01…04), schema.org JSON-LD (Organization/Course/Article — SEO-04), автогенерируемый /llms.txt (SEO-05), OG-картинки в стиле CRAT через next/og (SEO-02), обновлённый sitemap. Внешние шаги Ивана: Search Console/Вебмастер, UptimeRobot, статьи от course-factory.

**Architecture:** lib/content расширяется загрузчиком статей (тот же validateMdx; `<Trainer>` в статьях — ошибка по контракту §8); кэш-паттерн getContent. OG — ImageResponse (next/og, без зависимостей). llms.txt — route handler из контента. Статьи-заглушки 2 шт (заменит фабрика).

**Спеки:** ART-01…04, SEO-01…08; content-format §8; D-021/022; phases.md Ф6.

**Правила:** контракт §8 (meta.yaml: slug/title/description/date/draft; article.mdx = lesson.mdx минус Trainer); draft не публикуется и не в sitemap (ART-02); битая статья → лог+баннер, сайт живёт (ART-03); кириллица через t; тексты статей-заглушек помечаются «черновик — заменит course-factory».

---

### Task 1: Загрузчик статей в lib/content (TDD)

**Files:** Create `lib/content/articles.ts`, `lib/content/articles.test.ts`, фикстуры `lib/content/fixtures/articles-*`; Modify `lib/content/index.ts` (кэш+API), `instrumentation.ts` (лог ошибок статей)

- [ ] Типы: `ArticleMeta { slug, title, description, date: string, draft?: boolean }`, `Article { meta, mdx, dir }`. loadArticles(dir): читает content/articles/*/; правила §8: meta.yaml обязателен (slug===каталогу, title/description/date непустые, date — валидная ISO-дата), article.mdx валиден по validateMdx с `animationIds` и **пустым TRAINER-набором** — вернее: validateMdx проверяет Trainer по TRAINER_IDS; для статей нужен запрет ЛЮБОГО Trainer → добавь опцию `forbidComponents?: string[]` в MdxValidationCtx (validate-mdx.ts): имена из списка → ошибка «компонент <X> запрещён в этом разделе» (перед whitelist-проверкой). Тесты: валидная статья; draft; битый meta; Trainer в статье → ошибка; несуществующий каталог → пусто без ошибок (раздел опционален!).
- [ ] index.ts: `getArticles(): { articles: Article[] (не-draft, сортировка date desc), issues }` с кэшем на globalThis (паттерн getContent); `getArticle(slug)`; instrumentation: лог article-issues (тот же формат [content]).
- [ ] Прогоны (122+новые)+ Commit `"Ф6: загрузчик статей — контракт §8, запрет Trainer (ART-01…03)"` (+трейлер Co-Authored-By: Claude Fable 5 <noreply@anthropic.com> — везде).

---

### Task 2: Страницы /articles + 2 статьи-заглушки

**Files:** Create `app/articles/page.tsx`, `app/articles/[slug]/page.tsx`, `content/articles/{kak-nachat-s-ii,ii-bez-strashilok}/…`; Modify `lib/i18n/ru.ts`, `components/site.css`, `components/site/SiteHeader.tsx`+Footer (nav-ссылка «Статьи»)

- [ ] /articles: Header/Footer, kicker t.articles.kicker 'Статьи', crat-card список (title, description, дата formatDate) → /articles/{slug}; пусто → t.articles.empty. Метаданные (title/description/canonical из seo-строк t.seo.articlesTitle/articlesDescription — добавь).
- [ ] /articles/[slug]: getArticle → null/draft → notFound(); Header/Footer; kicker+дата, h1, MDXRemote с mdxComponents(assetBase статьи — расширь assetBase-хелпер или локально /content-assets/articles/{slug}); generateMetadata: title/description из meta, canonical /articles/{slug}, openGraph type article.
- [ ] content-assets route уже отдаёт из content/ — статьи покрыты автоматически (проверь путь).
- [ ] 2 статьи-заглушки: осмысленный русский черновик 3–5 абзацев по темам «Как начать пользоваться нейросетями: первые три шага» и «ИИ без страшилок: что он умеет и не умеет» (тон брифа: без хайпа, этика CRAT), meta с description, date сегодня, БЕЗ draft; пометка-курсив «Черновик — финальная версия придёт из course-factory». Компоненты: Callout/Divider для витрины.
- [ ] Nav: «Статьи» (t.footer.navArticles) в Header и Footer → /articles.
- [ ] Прогоны + smoke (список/статья рендерятся, notFound на мусор) + Commit `"Ф6: раздел /articles + 2 статьи-черновика (ART-01…04, SITE-07-nav)"`.

---

### Task 3: JSON-LD (SEO-04)

**Files:** Create `components/site/JsonLd.tsx`; Modify `app/page.tsx`, `app/ai-basics/page.tsx`, `app/articles/[slug]/page.tsx`

- [ ] JsonLd: `<script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(data)}} />` — данные строятся ТОЛЬКО из наших словарей/контента (не user input), комментарий об этом.
- [ ] Главная: Organization {name 'CRAT studio', url APP_URL, description t.seo.homeDescription, email из footer}. Лендинг: Course {name из course.yaml, description t.seo.landingDescription, provider Organization, inLanguage 'ru', offers? НЕТ (цены нет до Ф7 — не выдумывать)}. Статья: Article {headline, description, datePublished, inLanguage, publisher Organization}.
- [ ] Проверка: build + curl каждой страницы | grep ld+json + прогон JSON.parse извлечённого (валидность). Commit `"Ф6: JSON-LD — Organization, Course, Article (SEO-04)"`.

---

### Task 4: /llms.txt (SEO-05)

**Files:** Create `app/llms.txt/route.ts`

- [ ] GET text/plain; markdown-структура из контента: `# CRAT studio` + label/heroSubtitle из t; `## Курс` + title/описание + список модулей из course.yaml + ссылка /ai-basics; `## Статьи` + title+description+URL опубликованных; `## Контакты` email. Кэш force-dynamic не нужен — пусть revalidate 3600 (route: `export const revalidate = 3600`).
- [ ] Прогон + curl-проверка + Commit `"Ф6: /llms.txt — автогенерация из контента (SEO-05, GEO)"`.

---

### Task 5: OG-картинки (SEO-02 полный)

**Files:** Create `app/opengraph-image.tsx`, `app/ai-basics/opengraph-image.tsx`, `app/articles/[slug]/opengraph-image.tsx`

- [ ] next/og ImageResponse 1200×630, стиль CRAT литералами: фон #0E0B0B, kicker-строка uppercase #B9A7D6 (letterSpacing), заголовок крупный #F2E9DC, красная линия #FF4B3A с glow (boxShadow), внизу cratstudio.com. Шрифты — дефолтные satori (без внешних загрузок; Cormorant недоступен — допустимое упрощение, зафиксируй комментарием). Заголовки: главная — heroTitle; лендинг — course.title; статья — meta.title (generateImageMetadata/params).
- [ ] Прогон build (og-роуты в выводе) + dev-curl /opengraph-image → 200 image/png. Commit `"Ф6: OG-картинки в стиле CRAT через next/og (SEO-02)"`.

---

### Task 6: sitemap + финальный прогон + README

**Files:** Modify `app/sitemap.ts`, `README.md`

- [ ] sitemap: + /articles (0.8) + каждая опубликованная статья (0.7, lastModified из meta.date). Draft — нет (ART-02: getArticles уже фильтрует).
- [ ] README: раздел «Запуск-пакет (Ф6)»: шаги Ивана — Search Console (подтвердить домен, отправить sitemap), Яндекс.Вебмастер (то же), UptimeRobot (монитор https://cratstudio.com/api/health, keyword ok); заметка что статьи — из course-factory заменой файлов.
- [ ] Финальный прогон: typecheck/lint/test/build; smoke-чеклист: /articles, статья, /llms.txt, sitemap с статьями, OG-роуты, /health жив, гейты живы. Commit `"Ф6: sitemap со статьями, README запуск-пакета"`.

---

## Внешние шаги Ивана
1. Google Search Console + Яндекс.Вебмастер: подтвердить cratstudio.com, отправить sitemap.xml (SEO-08).
2. UptimeRobot: HTTPS-монитор /api/health.
3. Статьи от course-factory (5–10 к запуску) — заглушки заменяются файлами.

## Self-review
- ART-01 (T1/T2), ART-02 (draft-фильтр T1 + sitemap T6), ART-03 (issues+instrumentation T1), ART-04 (2 заглушки + внешняя зависимость), SEO-02 (T5+metadata есть с Ф1/Ф5), SEO-04 (T3), SEO-05 (T4), SEO-07 (slug'и латиницей — заглушки соответствуют), SEO-08/06 (README+шаги Ивана; CWV — страницы статичны, аудит на проде).
- Контракт §8: forbidComponents-механика — расширение validate-mdx БЕЗ изменения поведения уроков (opt-in параметр).
- Порядок: T1→T2→T3→T4→T5→T6.
