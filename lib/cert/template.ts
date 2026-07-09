import { t } from '@/lib/i18n'

/** HTML-шаблон PDF-сертификата (черновик-плейсхолдер до Ф5-макета; CERT-04, D-011).
 *  Цвета — литералы токенов lib/design/tokens.css: PDF-рендер не читает CSS-файлы. */
export function certificateHtml(opts: { fullName: string; courseTitle: string; number: string; dateStr: string }): string {
  return `<!doctype html><html><body style="margin:0"><div style="width:1123px;height:794px;background:#0E0B0B;color:#F2E9DC;font-family:Georgia,serif;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:60px;box-sizing:border-box">
    <div style="color:#FF4B3A;font-size:28px;letter-spacing:6px">CRAT STUDIO</div>
    <div style="font-size:22px;margin-top:40px;color:#B9A7D6">${t.cert.pdfIssuedTo}</div>
    <div style="font-size:52px;margin:16px 0;overflow-wrap:break-word">${esc(opts.fullName)}</div>
    <div style="font-size:22px;color:#B9A7D6">${t.cert.pdfCompleted}</div>
    <div style="font-size:30px;margin:16px 0;max-width:900px;overflow-wrap:break-word">${esc(opts.courseTitle)}</div>
    <div style="margin-top:48px;font-size:18px;color:#7FD6B4">${opts.dateStr} · ${opts.number}</div>
    <div style="margin-top:8px;font-size:16px;color:#B9A7D6">${t.cert.pdfVerify}: cratstudio.com/cert/${opts.number}</div>
  </div></body></html>`
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
