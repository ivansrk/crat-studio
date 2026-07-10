import Link from 'next/link'
import { peekResetToken } from '@/lib/auth/reset'
import { ResetTokenPurpose } from '@/lib/generated/prisma/client'
import { ConfirmForm } from '../ConfirmForm'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'

export const dynamic = 'force-dynamic' // токен одноразовый — состояние не кешируем

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.confirm.kicker} />
            {children}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}

// Ф7б Task 4 (REG-13): confirmRegistration МУТИРУЕТ (гасит токен, может создать User/Enrollment) —
// вызывать её на GET нельзя (боты/почтовые превью/предзагрузка сожгли бы одноразовую ссылку раньше
// живого человека, тот же риск, что T6 решал для /reset/{token}). Компромисс: GET рендерит либо
// invalid/used/expired-экран по peekResetToken (безопасный findUnique-предпросмотр, НИКОГДА не
// гасит), либо страницу с ОДНОЙ кнопкой «Подтвердить» — саму мутацию делает клик человека через
// server action (app/actions/confirm.ts → confirmRegistration), см. ConfirmForm.tsx.
export default async function InviteConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const state = await peekResetToken(token, undefined, ResetTokenPurpose.OPT_IN)

  if (state.status !== 'ok') {
    const title = state.status === 'expired' ? t.confirm.expiredTitle
      : state.status === 'used' ? t.confirm.usedTitle
      : t.confirm.invalidTitle
    return (
      <Frame>
        <div className="crat-card accepted-card">
          <h1 className="crat-display">{title}</h1>
          <p className="crat-muted">{t.confirm.invalidBody}</p>
          <Link className="crat-button primary" href="/ai-basics#signup">{t.confirm.resubmitCta}</Link>
        </div>
      </Frame>
    )
  }

  return (
    <Frame>
      <h1 className="crat-display">{t.confirm.kicker}</h1>
      <ConfirmForm token={token} />
    </Frame>
  )
}
