import { chromium } from 'playwright'
import { certificateHtml } from './template'

/** PDF по требованию (D-011): не хранится, рендерится при письме и каждом скачивании. */
export async function renderCertificatePdf(opts: Parameters<typeof certificateHtml>[0]): Promise<Buffer> {
  const browser = await chromium.launch({ args: ['--no-sandbox'] }) // Render: без sandbox-привилегий
  try {
    const page = await browser.newPage()
    await page.setContent(certificateHtml(opts), { waitUntil: 'load' })
    return await page.pdf({ width: '1123px', height: '794px', printBackground: true, pageRanges: '1' })
  } finally {
    await browser.close()
  }
}
