# Изображения для сайта CRAT studio — бриф на генерацию

Стиль — из дизайн-брифа: **Black is the space, Red is the light.** Ночной город, красные вывески, маленький кинотеатр, архив, мастерская. Без стоков, без SaaS-глянца, без людей-с-ноутбуками.

## Как работаем

1. Ты генеришь картинки по промптам ниже (Midjourney / Flux / что тебе удобно).
2. Складываешь **оригиналы в максимальном размере** в папку `_incoming/` в корне проекта, **с точными именами файлов** из таблицы (расширение любое: png/jpg/webp).
3. Логотип — кладёшь исходник туда же: `logo.svg` (идеал) или `logo.png` (прозрачный фон, ≥1024px по длинной стороне).
4. Пишешь мне «картинки готовы» — дальше всё моё: оптимизация (webp, размеры, вес), полный набор фавиконов из логотипа, встройка в код, тёмные оверлеи/зерно поверх, проверка на 360/768/1440, ревью.

Можно частями: положил 2–3 штуки → скажи — встрою, посмотрим, скорректируем промпты.

## Общий стилевой хвост (добавляй к каждому промпту)

```
cinematic still, deep near-black background, red neon light glow as the only strong light source, subtle film grain, analog imperfection, muted warm cream highlights, occasional faded teal accent, editorial arthouse poster aesthetic, quiet composition with lots of negative space, no text, no letters, no watermark, no people looking at camera --ar (см. у каждой картинки)
```

## Список изображений

| # | Файл в `_incoming/` | Что это | Пропорция |
|---|---|---|---|
| 0 | `logo.svg` / `logo.png` | твой логотип (не генерить) | — |
| 1 | `hero-home.png` | герой главной | 16:9 |
| 2 | `dir-education.png` | карточка «Обучаем» | 4:5 |
| 3 | `dir-automation.png` | карточка «Автоматизируем» | 4:5 |
| 4 | `dir-creative.png` | карточка «Создаём» | 4:5 |
| 5 | `hero-course.png` | герой лендинга курса | 16:9 |
| 6 | `studio-1.png` … `studio-4.png` | 4 кадра секции «Креативная студия» | разные |
| 7 | `article-kak-nachat.png`, `article-bez-strashilok.png` | обложки 2 статей | 16:9 |

Итого генерить: **11 картинок**.

### 1. Герой главной — `hero-home.png` (16:9)
```
a small night cinema screen glowing red in a dark empty room, thin neon horizon line, faint silhouettes of city rooftops at the bottom edge, atmosphere of a private archive workshop at night
```

### 2. «Обучаем» — `dir-education.png` (4:5)
```
a single desk lamp casting warm light on an open notebook and handwritten diagrams, dark room, one thin red neon line on the wall, mood of quiet late-night study in a workshop
```

### 3. «Автоматизируем» — `dir-automation.png` (4:5)
```
an orderly wall of small archive drawers and index cards, one drawer slightly open emitting soft red light, mechanical precision, quiet industrial mood
```

### 4. «Создаём» — `dir-creative.png` (4:5)
```
a cutting mat with photographic prints, ink pen and torn paper collage in progress, lit by a red neon sign out of frame, craft table of a night studio, hands-on analog work
```

### 5. Герой лендинга курса — `hero-course.png` (16:9)
```
an empty classroom at night transformed into a small cinema, rows of simple chairs facing a softly glowing warm screen, red exit-sign light in the corner, inviting but serious mood
```

### 6. Креативная студия — `studio-1..4.png`
- `studio-1` (3:4): `red neon horizon line over a dark field, minimalist, almost abstract`
- `studio-2` (1:1): `a faded teal-green light spot on textured dark wall, analog projector glow`
- `studio-3` (3:4): `close-up of a hand-drawn storyboard frame pinned to a dark wall, red thread connecting notes`
- `studio-4` (16:9): `long thin neon line reflecting on wet asphalt at night, quiet street, no cars`

### 7. Обложки статей (16:9)
- `article-kak-nachat.png`: `a first small step: a single lit doorway in a long dark corridor, warm light spilling out, beginning of a path`
- `article-bez-strashilok.png`: `a friendly desk robot toy made of paper sitting under a warm lamp, harmless and small, dark room, gentle mood`

## Что НЕ нужно генерить

- **Фавиконы, apple-touch-icon, иконки** — нарежу из твоего логотипа.
- **OG-картинки для шаринга** — уже генерятся кодом в стиле CRAT.
- **Фото команды** — генерить нельзя (это реальные люди). Если хочешь фото вместо текущих CSS-плейсхолдеров — пришли реальные фотографии 4 участников (любые приличные, ≥800px), я приведу к единому тёмному стилю. Если нет — плейсхолдеры остаются, они в стиле.
- **Кабинет студента** («линия горизонта», квиз-прожектор) — это CSS-графика по брифу, картинки там не нужны.

## Примечание к брифу

Дизайн-бриф §7.2 предписывал hero «БЕЗ картинок» (CSS-кадр). Это ТЗ Ивана от 2026-07-10 обновляет: hero и карточки получают сгенерированные изображения в фирменном стиле, CSS-эффекты (glow, зерно, рамки) остаются поверх. Зафиксирую в DECISIONS.md при встройке.
