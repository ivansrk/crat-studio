import { chromium } from 'playwright'
import { certificateHtml } from './template'

/** PDF по требованию (D-011): не хранится, рендерится при письме и каждом скачивании.
 *  D-044: шаблон Ивана — 2 страницы A4 landscape (сертификат + приложение), размер задан
 *  в CSS (`@page { size: A4 landscape; margin: 0 }`) — preferCSSPageSize ОБЯЗАТЕЛЕН, иначе
 *  Chromium подставит дефолтный Letter/margin и макет съедет. printBackground ОБЯЗАТЕЛЕН —
 *  шаблон тёмный (background: var(--bg)), без него страницы печатаются белыми. pageRanges
 *  убран (был 'page 1 only' для старого 1-страничного плейсхолдера) — нужны обе страницы. */
export async function renderCertificatePdf(opts: Parameters<typeof certificateHtml>[0]): Promise<Buffer> {
  const browser = await chromium.launch({ args: ['--no-sandbox'] }) // Render: без sandbox-привилегий
  try {
    const page = await browser.newPage()
    await page.setContent(certificateHtml(opts), { waitUntil: 'load' })
    return await page.pdf({ printBackground: true, preferCSSPageSize: true })
  } finally {
    await browser.close()
  }
}
