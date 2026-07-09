import { db } from '@/lib/db'
import { generatePassword, hashPassword } from './password'
import type { PrismaClient } from '@/lib/generated/prisma/client'

export type ProvisionInput = {
  email: string
  firstName: string
  lastName: string
  phone?: string | null
  telegram?: string | null
}

export type ProvisionResult = {
  user: { id: string; email: string }
  plainPassword: string | null // null: юзер уже был с паролем — не перевыпущен (идемпотентность)
}

/** AUTH-15/F11: единая точка создания учётки с паролем — ручная выдача (ADM-03) и, в Ф7б,
 *  авто-доступ по инвайту (REG-13) и Stripe webhook (PAY-02) заведут учётку тут же.
 *  Идемпотентно (REG-14): если у юзера УЖЕ есть passwordHash — пароль не трогаем и не
 *  перевыпускаем (повторная выдача доступа не должна сбрасывать действующий пароль),
 *  plainPassword=null; контактные поля тоже не перезаписываем — только на создании.
 *  Если юзера нет или passwordHash=null (D-034: старые юзеры до Ф7а) — генерируем пароль
 *  (D-033) и хэшируем (D-032). Открытый пароль живёт только в возврате — ни в БД, ни в логах.
 *  tx-совместимость: client — тот же Pick-паттерн, что mintLoginUrl/mintResetToken (передавайте
 *  транзакционный tx, чтобы provisioning был частью вызывающей транзакции). */
export async function createUserWithPassword(
  input: ProvisionInput,
  client: Pick<PrismaClient, 'user'> = db,
): Promise<ProvisionResult> {
  const existing = await client.user.findUnique({ where: { email: input.email } })

  if (existing?.passwordHash) {
    return { user: { id: existing.id, email: existing.email }, plainPassword: null }
  }

  const plainPassword = generatePassword()
  const passwordHash = await hashPassword(plainPassword)

  const user = existing
    ? await client.user.update({ where: { id: existing.id }, data: { passwordHash } })
    : await client.user.create({
        data: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          telegram: input.telegram,
          passwordHash,
        },
      })

  return { user: { id: user.id, email: user.email }, plainPassword }
}
