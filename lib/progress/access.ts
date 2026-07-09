import { db } from '@/lib/db'
import { isAdminEmail } from '@/lib/auth/current-user'
import type { User } from '@/lib/generated/prisma/client'

/** LES-06: уроки доступны студенту с enrollment; админ видит всё (проверка контента). */
export async function hasCourseAccess(user: User, courseSlug = 'ai-basics'): Promise<boolean> {
  if (isAdminEmail(user.email)) return true
  const e = await db.enrollment.findUnique({ where: { userId_courseSlug: { userId: user.id, courseSlug } } })
  return !!e
}
