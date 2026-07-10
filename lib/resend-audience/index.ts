import { Resend } from 'resend'
import { db } from '@/lib/db'
import type { PrismaClient } from '@/lib/generated/prisma/client'

// Ф7б F17/CRM-04…07: живой синк подписчиков с Resend Audience. Три операции — subscribe/
// unsubscribe/delete — вызываются из confirm.ts, unsubscribe-флоу и GDPR-удаления соответственно.
// Все три НИКОГДА не должны ронять основную операцию (CRM-05): сами функции при сбое БРОСАЮТ
// (чтобы вызывающий код узнал и мог залогировать/показать баннер рассинхрона), но каждый вызов
// снаружи обёрнут в `.catch(log)` — БД-операция (подтверждение/отписка/удаление) уже прошла
// до вызова этих функций и не откатывается.

export type SyncOutcome = 'synced' | 'skipped'

// Минимум полей, нужных для синка — принимает как полноценный User, так и «выжимку» из него
// (confirm.ts ещё не имеет полного User-объекта после $transaction, только id/email + данные заявки).
export type SyncUser = {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  resendContactId?: string | null
}

type DbClient = Pick<PrismaClient, 'user'>

function audienceId(): string | null {
  const id = process.env.RESEND_AUDIENCE_ID
  return id && id.trim() !== '' ? id.trim() : null
}

// Только используемое подмножество Resend.contacts — реальный клиент подставляется по умолчанию,
// тесты мокают npm-модуль 'resend' целиком (тот же приём, что и с sendEmail: vi.mock('@/lib/email')
// в других тестах — здесь мокаем транспортную зависимость, а не наш собственный модуль).
function contactsClient() {
  return new Resend(process.env.RESEND_API_KEY).contacts
}

// Resend SDK (проверено по node_modules/resend 6.17.2) не возвращает отдельный код ошибки для
// «контакт с таким email уже есть в audience» — только validation_error с текстом сообщения.
// [РЕШЕНИЕ АВТОРА — подтвердить у Ивана при первом реальном сбое в проде]: определяем дубль по
// тексту сообщения; если Resend когда-нибудь введёт отдельный код — заменить на него.
function isDuplicateContactError(message: string): boolean {
  return /already exists|duplicate/i.test(message)
}

async function recordSyncError(client: DbClient, userId: string, e: unknown): Promise<void> {
  const message = e instanceof Error ? e.message : String(e)
  await client.user.update({ where: { id: userId }, data: { resendSyncError: message } })
    .catch(writeErr => console.error('[resend-audience] не смог записать resendSyncError:', writeErr))
}

/** CRM-04: подтверждение подписки (REG-13, только авто/инвайт-путь — там уже есть User) →
 *  создать контакт в Audience; если уже есть (дубль) — обновить. Сохраняет resendContactId,
 *  сбрасывает resendSyncError. RESEND_AUDIENCE_ID пуст → 'skipped', платформа работает (CRM-06). */
export async function syncContactSubscribe(user: SyncUser, client: DbClient = db): Promise<SyncOutcome> {
  const aud = audienceId()
  if (!aud) {
    console.warn('[resend-audience] RESEND_AUDIENCE_ID не задан — синк подписки выключен (CRM-06)')
    return 'skipped'
  }

  const contacts = contactsClient()
  try {
    let contactId: string
    const created = await contacts.create({
      audienceId: aud,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      unsubscribed: false,
    })
    if (created.error) {
      if (!isDuplicateContactError(created.error.message)) throw new Error(created.error.message)
      const updated = await contacts.update({
        audienceId: aud,
        email: user.email,
        unsubscribed: false,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
      })
      if (updated.error) throw new Error(updated.error.message)
      contactId = updated.data!.id
    } else {
      contactId = created.data!.id
    }
    await client.user.update({ where: { id: user.id }, data: { resendContactId: contactId, resendSyncError: null } })
    return 'synced'
  } catch (e) {
    await recordSyncError(client, user.id, e)
    throw e
  }
}

/** CRM-04 (MAIL-06): отписка → пометить контакт unsubscribed=true, НЕ удалять.
 *  [РЕШЕНИЕ АВТОРА]: remove() стёр бы историю подавления — сохранённый в Resend Audience
 *  контакт с unsubscribed=true надёжнее для compliance/deliverability (Resend не будет слать
 *  повторные рассылки на этот адрес даже при случайном повторном импорте), чем полное удаление,
 *  после которого адрес мог бы «воскреснуть» подписанным при следующей ручной синхронизации.
 *  Полное удаление — только явный GDPR-путь (syncContactDelete). Ищем контакт по resendContactId,
 *  если его нет (например, был синк только по email до сохранения id) — по email. */
export async function syncContactUnsubscribe(user: SyncUser, client: DbClient = db): Promise<SyncOutcome> {
  const aud = audienceId()
  if (!aud) {
    console.warn('[resend-audience] RESEND_AUDIENCE_ID не задан — синк отписки выключен (CRM-06)')
    return 'skipped'
  }

  const contacts = contactsClient()
  try {
    const selector = user.resendContactId ? { id: user.resendContactId } : { email: user.email }
    const { error } = await contacts.update({ audienceId: aud, unsubscribed: true, ...selector })
    if (error) throw new Error(error.message)
    await client.user.update({ where: { id: user.id }, data: { resendSyncError: null } })
    return 'synced'
  } catch (e) {
    await recordSyncError(client, user.id, e)
    throw e
  }
}

/** CRM-04/ADM-10: GDPR-удаление — удалить контакт из Audience целиком (right to erasure, не
 *  просто unsubscribed). Вызывается ПЕРЕД удалением User в БД (lib/admin/gdpr.ts): resendSyncError
 *  писать некуда и незачем — строка User удаляется следом в той же операции в любом случае,
 *  вызывающий код просто логирует сбой (.catch(log)), удаление в БД не блокируется (CRM-05). */
export async function syncContactDelete(user: SyncUser, client: DbClient = db): Promise<SyncOutcome> {
  const aud = audienceId()
  if (!aud) {
    console.warn('[resend-audience] RESEND_AUDIENCE_ID не задан — синк удаления выключен (CRM-06)')
    return 'skipped'
  }

  const contacts = contactsClient()
  const selector = user.resendContactId ? { id: user.resendContactId } : { email: user.email }
  const { error } = await contacts.remove({ audienceId: aud, ...selector })
  if (error) throw new Error(error.message)
  void client // сигнатура одинакова с остальными двумя функциями (DI/консистентность) — записи не требует
  return 'synced'
}
