import { syncAdmins } from '@/lib/auth/sync-admins'
import { db } from '@/lib/db'

async function main() {
  const admins = await syncAdmins()
  console.log(`[seed v0] админы синхронизированы: ${admins.join(', ') || '(ADMIN_EMAILS пуст)'}`)
}

main()
  .catch((e) => { console.error('[seed] ошибка:', e); process.exitCode = 1 })
  .finally(() => db.$disconnect())
