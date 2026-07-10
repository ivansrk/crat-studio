# CRAT studio

Сайт студии + платформа онлайн-курсов: главная (`/`), лендинг курса «ИИ в профессиональной и личной деятельности» (`/ai-basics`), ЛМС — кабинет студента и админка (`/app`, `/admin`).

Спецификации и решения — источник правды для этого проекта: [CLAUDE.md](./CLAUDE.md), [docs/](./docs) (requirements.md, data-model.md, flows.md, content-format.md, phases.md, seed.md), [DECISIONS.md](./DECISIONS.md).

## Команды

```bash
npm run dev             # локальный запуск
npm run build           # прод-сборка (включает prisma generate)
npm run typecheck       # tsc --noEmit
npm run lint             # eslint
npm test                # vitest run
npm run seed            # scripts/seed.ts (идемпотентен)
npx prisma migrate dev  # локальная миграция
npm run send-set-password -- --dry-run  # Ф7а: разовая рассылка «задайте пароль» (см. ниже), сначала dry-run
```

## Локальная разработка

1. Node 22 (см. `.nvmrc`).
2. `npm i`
3. Postgres в Docker:

   ```bash
   docker run -d --name crat-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=crat -p 5432:5432 postgres:16
   ```

4. Скопировать `.env.example` в `.env` и заполнить `DATABASE_URL` (например, `postgresql://postgres:dev@localhost:5432/crat`).
5. `npx prisma migrate dev`
6. `npm run dev`

## Деплой на Render

1. Render → New → Blueprint → репозиторий `ivansrk/crat-studio` (`render.yaml` подхватится автоматически).
2. Заполнить env-переменные: `ADMIN_EMAILS`, `APP_URL`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` (`RESEND_API_KEY` и `ANTHROPIC_API_KEY` можно позже — понадобятся в Ф1/Ф4). `DATABASE_URL` и `SESSION_SECRET` создаются автоматически.
3. После первого деплоя — в настройках Postgres включить автобэкапы (SEC-07).
4. Проверить `/health`.

### Сертификаты (Playwright/Chromium, CERT-04, D-011)

PDF сертификата рендерится по требованию (не хранится) через Playwright + Chromium. На Render (native-окружение, без Docker) chromium ставится в `buildCommand` (`npx playwright install chromium`, без `--with-deps` — системные библиотеки для headless Chromium в Ubuntu-образе Render уже есть, апт-пакеты не нужны). Путь кэша браузера зафиксирован явно через `PLAYWRIGHT_BROWSERS_PATH=/opt/render/project/src/.cache/ms-playwright` (Render применяет envVars и к build, и к runtime — иначе дефолтный `$HOME/.cache` может не совпасть между фазами и рантайм не найдёт установленный браузер). Риск первого деплоя — проверить `/app/certificate` на проде: если Playwright не находит chromium, смотреть лог build (браузер должен ставиться там) и сверять `PLAYWRIGHT_BROWSERS_PATH` в обеих фазах.

## Запуск-пакет (Ф6)

Внешние шаги (руками Ивана, после деплоя на прод-домен):

1. **Google Search Console** — подтвердить владение `cratstudio.com`, отправить `https://cratstudio.com/sitemap.xml`.
2. **Яндекс.Вебмастер** — то же самое: подтвердить `cratstudio.com`, отправить `sitemap.xml`.
3. **UptimeRobot** — HTTPS-монитор на `https://cratstudio.com/api/health`, keyword-проверка на `ok`.

Статьи (`/articles`) приходят из course-factory заменой файлов в `content/articles/` — 2 текущие статьи в репозитории черновые (курсив-пометка на странице) и будут заменены при первой поставке (5–10 статей к запуску, ART-04).

## Миграция на пароли (Ф7а)

Порядок безопасного выката (подробнее — docs/data-model.md «Порядок безопасного выката Ф7а», D-034): миграция схемы (`passwordHash` nullable) → деплой кода с паролями (у существующих юзеров `passwordHash=null`, вход по паролю для них пока невозможен, но постоянная ссылка «Забыли пароль / первый вход» на `/login`, AUTH-19, работает всегда) → разовая рассылка `send-set-password`, которая закрывает переход для тех, кто сам не пойдёт через «Забыли пароль». Оба пути ведут на один reset-механизм, поэтому юзер ничего не теряет, даже если рассылку не запускать сразу после деплоя.

Скрипт `scripts/send-set-password.ts` выбирает всех `User` с `passwordHash=null` и шлёт им письмо PASSWORD_RESET со ссылкой «задать пароль» (`mintResetToken`, TTL 60 минут). Идемпотентен: перед отправкой проверяет, нет ли у юзера уже неистёкшего непогашенного PASSWORD_RESET-токена — если есть, пропускает с логом «уже отправлено». Повторные запуски безопасны и не спамят.

```bash
npm run send-set-password -- --dry-run  # сначала: только перечислить кандидатов, письма не шлются
npm run send-set-password               # боевой прогон
```
