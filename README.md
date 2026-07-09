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
