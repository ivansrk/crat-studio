import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(process.cwd(), 'content')
const MIME: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf' }

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params
  const target = path.normalize(path.join(ROOT, ...parts))
  if (!target.startsWith(ROOT + path.sep)) return new Response(null, { status: 404 })
  const ext = path.extname(target).toLowerCase()
  if (!MIME[ext] || !fs.existsSync(target)) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(fs.readFileSync(target)), { headers: { 'Content-Type': MIME[ext], 'Cache-Control': 'public, max-age=3600' } })
}
