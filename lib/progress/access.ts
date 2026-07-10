import { db } from '@/lib/db'
import { isAdminEmail } from '@/lib/auth/current-user'
import type { User } from '@/lib/generated/prisma/client'

/** LES-06/MC-07: уроки доступны студенту с enrollment на конкретный курс; админ видит всё
 *  (проверка контента). courseSlug — обязательный явный параметр (Ф7в T2, D-036): дефолта
 *  на 'ai-basics' больше нет, чтобы typecheck ловил забытые per-course вызовы. */
export async function hasCourseAccess(user: User, courseSlug: string): Promise<boolean> {
  if (isAdminEmail(user.email)) return true
  const e = await db.enrollment.findUnique({ where: { userId_courseSlug: { userId: user.id, courseSlug } } })
  return !!e
}
