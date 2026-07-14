import { getCourse } from '@/lib/content'
import { escapeHtml } from '@/lib/email/templates'

/** CERT-04/D-044: HTML программы курса для страницы-приложения к сертификату — модули и уроки
 *  по факту course.yaml (единственный источник состава курса, docs/content-format.md §2), а не
 *  захардкоженный текст. course.yaml уже хранит заголовок модуля с префиксом «Модуль N. …»
 *  (см. content/ai-basics/course.yaml) — здесь он не дублируется. Пустая строка, если курс
 *  не найден (шаблон должен пережить отсутствие курса, а не упасть, правило 6). */
export function buildProgramHtml(courseSlug: string): string {
  const entry = getCourse(courseSlug)
  if (!entry) return ''
  return entry.course.modules
    .map(mod => {
      const items = mod.lessons.map(l => `<li>${escapeHtml(l.title)}</li>`).join('')
      return `<h3>${escapeHtml(mod.title)}</h3><ol>${items}</ol>`
    })
    .join('')
}

/** CERT-08/D-044: период обучения на сертификате = дата начала + 3 календарных месяца.
 *  Арифметика — над UTC-компонентами даты (не над локальным часовым поясом процесса), чтобы
 *  результат не зависел от TZ хост-машины/Render (правило 5: в базе UTC); отображение —
 *  Europe/Warsaw, как и остальные даты в приложении (lib/i18n/format-date.ts). JS Date сам
 *  нормализует конец месяца (напр. 30 ноября + 3 месяца → конец февраля/начало марта) —
 *  поведение зафиксировано тестом, вручную не корректируется.
 *  Формат: один год — «14 июля — 14 октября 2026»; на стыке лет — оба года у обеих дат:
 *  «14 декабря 2026 — 14 марта 2027». */
export function buildPeriodStr(start: Date): string {
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 3)

  const dayMonth = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' })
  const year = (d: Date) => d.toLocaleDateString('ru-RU', { year: 'numeric', timeZone: 'Europe/Warsaw' })

  const startYear = year(start)
  const endYear = year(end)
  const startLabel = startYear === endYear ? dayMonth(start) : `${dayMonth(start)} ${startYear}`
  return `${startLabel} — ${dayMonth(end)} ${endYear}`
}
