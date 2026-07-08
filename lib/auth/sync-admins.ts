import { db } from '@/lib/db'
import { parseAdminEmails } from './parse-admin-emails'

/** Создаёт/чинит админ-учётки из ADMIN_EMAILS. Понижение ролей НЕ делает:
 *  доступ в админку проверяется по env на каждый запрос (AUTH-10), а не по полю role. */
export async function syncAdmins(): Promise<string[]> {
  const emails = parseAdminEmails(process.env.ADMIN_EMAILS)
  for (const email of emails) {
    await db.user.upsert({
      where: { email },
      update: { role: 'ADMIN' },
      create: { email, firstName: 'Admin', lastName: email.split('@')[0], role: 'ADMIN' },
    })
  }
  return emails
}
