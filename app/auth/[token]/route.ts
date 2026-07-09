import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { consumeMagicLink } from '@/lib/auth/magic-link'
import { signSession, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/auth/session'
import { sessionSecret } from '@/lib/auth/secret'

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const r = await consumeMagicLink(token)
  if (!r.ok) redirect(`/login/invalid?reason=${r.reason === 'expired' ? 'expired' : 'used'}`)
  const jar = await cookies()
  jar.set(SESSION_COOKIE, signSession(r.userId, sessionSecret()), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: SESSION_TTL_MS / 1000, path: '/',
  })
  redirect(r.isAdmin ? '/admin' : '/app') // AUTH-04
}
