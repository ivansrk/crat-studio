import { permanentRedirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Ф7в T3 (MC-04/E-MC1): старый маршрут без courseSlug — 308 на курс ai-basics. */
export async function GET() {
  permanentRedirect('/app/ai-basics/certificate')
}
