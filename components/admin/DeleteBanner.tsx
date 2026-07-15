import { t } from '@/lib/i18n'

/** Банер результата удаления участника (?del=…) — общий для всех разделов админки (D-050). */
const BANNER: Record<string, { text: string; alert: boolean }> = {
  deleted: { text: t.admin.delDone, alert: false },
  email_mismatch: { text: t.admin.delMismatch, alert: true },
  is_admin: { text: t.admin.delIsAdmin, alert: true },
  not_found: { text: t.admin.delNotFound, alert: true },
}

export function DeleteBanner({ del }: { del?: string }) {
  const b = del ? BANNER[del] : undefined
  if (!b) return null
  return <p role={b.alert ? 'alert' : undefined} className={b.alert ? 'form-alert' : 'crat-muted'}>{b.text}</p>
}
