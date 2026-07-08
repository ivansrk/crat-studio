import fs from 'node:fs'
import path from 'node:path'

// Допущение: content/ приходит из git-checkout, симлинков там нет.
// При появлении пользовательских загрузок — добавить realpath-проверку.
const ROOT = path.join(process.cwd(), 'content')
const MIME: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf' }

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params
  const target = path.normalize(path.join(ROOT, ...parts))
  if (!target.startsWith(ROOT + path.sep)) return new Response(null, { status: 404 })
  const ext = path.extname(target).toLowerCase()
  if (!MIME[ext]) return new Response(null, { status: 404 })
  try {
    const data = await fs.promises.readFile(target)
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': MIME[ext],
        'Cache-Control': 'public, max-age=3600',
        // SVG может содержать скрипты — запрещаем им исполняться при прямом открытии
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
