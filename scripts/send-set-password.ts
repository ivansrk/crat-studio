import { pathToFileURL } from 'node:url'
import { db } from '@/lib/db'
import { mintResetToken } from '@/lib/auth/reset'
import { sendEmail } from '@/lib/email'
import { renderEmail } from '@/lib/email/templates'
import { t } from '@/lib/i18n'
import { ResetTokenPurpose, type PrismaClient } from '@/lib/generated/prisma/client'

// Ф7а Task 7, D-034: разовая рассылка «задайте пароль» существующим юзерам (passwordHash=null),
// созданным до перехода на вход по паролю. Порядок выката — docs/data-model.md «Порядок
// безопасного выката Ф7а»: деплой кода с паролями → эта рассылка (или юзер сам идёт через
// «Забыли пароль», AUTH-19 — оба пути ведут на один и тот же reset-механизм).
export type CampaignResult = { total: number; sent: number; skipped: number; failed: number }

/** DI-клиент — тот же приём, что lib/auth/reset.ts (client: Pick<PrismaClient, ...> = db),
 *  чтобы тест мог подставить фейковый store без vi.mock('@/lib/db'). dryRun только перечисляет
 *  кандидатов и НЕ создаёт reset-токен (mintResetToken пишет в БД) и НЕ шлёт письмо. */
export async function runSetPasswordCampaign(
  client: Pick<PrismaClient, 'user' | 'passwordResetToken'> = db,
  opts: { dryRun?: boolean } = {},
): Promise<CampaignResult> {
  const dryRun = opts.dryRun ?? false
  const candidates = await client.user.findMany({ where: { passwordHash: null } })

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const user of candidates) {
    try {
      // Идемпотентность: живой (не истёкший, не использованный) PASSWORD_RESET-токен уже
      // означает «письмо отправлено» — повторный прогон не должен заспамить (D-034).
      const live = await client.passwordResetToken.findFirst({
        where: { email: user.email, purpose: ResetTokenPurpose.PASSWORD_RESET, usedAt: null, expiresAt: { gt: new Date() } },
      })
      if (live) {
        skipped++
        console.log(`[send-set-password] уже отправлено (живой токен): ${user.email}`)
        continue
      }

      if (dryRun) {
        sent++
        console.log(`[send-set-password] (dry-run) отправил бы: ${user.email}`)
        continue
      }

      const { url } = await mintResetToken(user.email, ResetTokenPurpose.PASSWORD_RESET, client)
      await sendEmail({
        to: user.email,
        userId: user.id,
        type: 'PASSWORD_RESET',
        subject: t.email.setPasswordSubject,
        html: renderEmail({ body: t.email.setPasswordBody, buttonText: t.email.resetButton, buttonUrl: url }),
        payload: {}, // D-028: сырой токен/URL в email_log не храним
      })
      sent++
      console.log(`[send-set-password] отправлено: ${user.email}`)
    } catch (err) {
      // Сбой одного письма (Resend/БД) не должен ронять рассылку остальным (Task 7).
      failed++
      console.error(`[send-set-password] ошибка для ${user.email}:`, err)
    }
  }

  return { total: candidates.length, sent, skipped, failed }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('[send-set-password] режим dry-run: письма НЕ отправляются')

  const result = await runSetPasswordCampaign(db, { dryRun })
  console.log(
    `[send-set-password] итого без пароля: ${result.total}, отправлено: ${result.sent}, `
    + `пропущено (уже отправлено): ${result.skipped}, ошибок: ${result.failed}`,
  )
}

// Ревью M2: main() на верхнем уровне модуля запускался и при `import` (scripts/send-set-password.test.ts
// импортирует runSetPasswordCampaign из этого же файла) — тест бил боевой DATABASE_URL. Guard запускает
// main() только при прямом вызове `tsx scripts/send-set-password.ts` (process.argv[1]), не при импорте.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
    .catch((e) => { console.error('[send-set-password] ошибка:', e); process.exitCode = 1 })
    .finally(() => db.$disconnect())
}
