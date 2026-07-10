import { db } from '@/lib/db'
import { limiters } from './rate-limit'
import { verifyPassword } from './password'
import { isAdminEmail } from './current-user'
import type { PrismaClient } from '@/lib/generated/prisma/client'

// Валидный bcrypt-хэш заведомо неверного пароля. Прогоняем его через verifyPassword, когда
// пользователя нет или у него не задан пароль — иначе ответ на несуществующий email уходит
// быстрее (нет bcrypt.compare) и по времени ответа можно понять, что email не зарегистрирован
// (SEC-03/SEC-06: анти-timing, тот же приём, что и в consumeMagicLink для unknown-токенов).
const DUMMY_HASH = '$2b$12$Lk.1Iczwzn8Ze/lP3WV92ejWbpISJdhYR.3nZWK8Hh/SzQ81QuGSa'

export type LoginResult = { ok: true; userId: string; isAdmin: boolean } | { ok: false }

/** AUTH-12/13/19: вход по email+паролю. Rate-limit по email и IP (AUTH-20); при превышении
 *  ответ неотличим от неверного пароля (SEC-06). Сессию не создаёт — чистая логика,
 *  server action (Task 6) сама вызывает signSession после ok:true. */
export async function attemptLogin(
  rawEmail: string,
  password: string,
  ip: string,
  client: Pick<PrismaClient, 'user'> = db,
): Promise<LoginResult> {
  const email = rawEmail.trim().toLowerCase()

  // [РЕШЕНИЕ АВТОРА, ревью m1] loginIp считает и успешные входы, хотя AUTH-20 говорит о неудачных:
  // сбрасывать общий IP-ключ на каждый успех стёр бы счётчик атакующего, который параллельно подбирает
  // пароль к другому аккаунту с того же IP (NAT/офис). Осознанный компромисс — 20 входов/15мин с одного
  // IP как общий бюджет достаточно щедрый, ложный лок от него маловероятен и приемлем.
  if (!limiters.loginEmail.allow(`le:${email}`) || !limiters.loginIp.allow(`lip:${ip}`)) {
    return { ok: false } // AUTH-20, наружу неотличимо от неверного пароля (SEC-06)
  }

  const user = await client.user.findUnique({ where: { email } })
  const hash = user?.passwordHash ?? DUMMY_HASH
  const valid = await verifyPassword(password, hash)

  if (!user || !user.passwordHash || !valid) return { ok: false } // AUTH-13/19

  limiters.loginEmail.reset(`le:${email}`)
  return { ok: true, userId: user.id, isAdmin: isAdminEmail(user.email) }
}
