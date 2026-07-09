'use server'
import { redirect } from 'next/navigation'
import { clientIp } from '@/lib/auth/client-ip'
import { limiters } from '@/lib/auth/rate-limit'
import { requestMagicLink } from '@/lib/auth/magic-link'

export async function requestLinkAction(formData: FormData) {
  // SEC-03: IP-лимит (10/15мин) — на уровне action как edge-защита против оркестровки многих email
  // с одного IP; email-лимит (AUTH-08) — внутри lib как инвариант домена. Появится второй
  // вызывающий requestMagicLink — перенести IP-лимит в lib. При отказе письмо не шлём,
  // но ответ тот же (SEC-06).
  if (limiters.magicLinkIp.allow(`mlip:${await clientIp()}`)) {
    await requestMagicLink(String(formData.get('email') ?? ''))
  }
  redirect('/login/sent') // AUTH-02: ответ всегда одинаковый
}
