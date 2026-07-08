import { cache } from 'react'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifySession, SESSION_COOKIE } from './session'
import { sessionSecret } from './secret'
import { parseAdminEmails } from './parse-admin-emails'
import type { User } from '@/lib/generated/prisma/client'

/** cache(): layout и page в одном рендере делают один findUnique, не два; staleness нет — дедуп только внутри запроса. */
export const currentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies()
  const uid = verifySession(jar.get(SESSION_COOKIE)?.value, sessionSecret())
  if (!uid) return null
  return db.user.findUnique({ where: { id: uid } })
})

/** Админ = email в ADMIN_EMAILS, проверяется по env на КАЖДЫЙ запрос (AUTH-10), не по полю role. */
export function isAdminEmail(email: string): boolean {
  return parseAdminEmails(process.env.ADMIN_EMAILS).includes(email.toLowerCase())
}
