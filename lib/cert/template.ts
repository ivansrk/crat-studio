import fs from 'node:fs'
import path from 'node:path'
import { escapeHtml, fillPlaceholders } from '@/lib/email/templates'

/** HTML-шаблон PDF-сертификата (D-044): финальный макет Ивана — lib/cert/certificate.html
 *  (скопирован из _incoming/certificate.html, НЕ редактируется вручную; обновляется только
 *  заменой файла целиком). 2 страницы A4 landscape: сертификат + приложение с программой курса.
 *  Кэш файла на процесс — тот же приём, что lib/content/index.ts (globalThis): 843KB с
 *  base64-логотипами не читать с диска на каждый рендер PDF. */
const g = globalThis as unknown as { __certTemplateHtml?: string }

function loadTemplateFile(): string {
  if (g.__certTemplateHtml === undefined) {
    g.__certTemplateHtml = fs.readFileSync(path.join(process.cwd(), 'lib/cert/certificate.html'), 'utf8')
  }
  return g.__certTemplateHtml
}

export function certificateHtml(opts: {
  fullName: string
  number: string
  courseTitle: string
  hours: number
  periodStr: string
  programHtml: string
}): string {
  return fillPlaceholders(loadTemplateFile(), {
    // fullName/courseTitle — пользовательские/контентные значения, экранируем (M-1, тот же приём,
    // что renderConsultationEmail в lib/email/templates.ts).
    fullName: escapeHtml(opts.fullName),
    number: escapeHtml(opts.number),
    courseTitle: escapeHtml(opts.courseTitle),
    hours: escapeHtml(String(opts.hours)),
    // {{dateStr}} в шаблоне Ивана — это ПЕРИОД обучения (CERT-08), не момент выдачи;
    // имя плейсхолдера в HTML менять не стали, чтобы не расходиться с исходником Ивана.
    dateStr: opts.periodStr,
    // programHtml уже готовая разметка с экранированным текстом внутри (lib/cert/program.ts,
    // buildProgramHtml) — здесь НЕ экранируем повторно, иначе теги <h3>/<ol>/<li> превратятся в текст.
    programHtml: opts.programHtml,
  })
}
