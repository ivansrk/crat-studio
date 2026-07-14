import type { Metadata } from 'next'
import { getInviteByToken, getInviteState } from '@/lib/invite'
import { SignupForm } from '@/components/signup-form'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'

export const metadata: Metadata = { title: t.landing.signupTitle }
export const dynamic = 'force-dynamic' // счётчик регистраций/срок инвайта проверяются на каждый заход

/** INV-03/04, E-INV1, F14: публичная форма регистрации по инвайт-ссылке, без аутентификации.
 *  Токен неизвестен/отозван/просрочен/исчерпан → «Ссылка недействительна», форма не рендерится. */
export default async function InvitePage({ params, searchParams }: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ signup?: string }>
}) {
  const { token } = await params
  const { signup } = await searchParams
  const invite = await getInviteByToken(token)
  const state = invite ? getInviteState(invite) : 'revoked'

  if (!invite || state !== 'ok') {
    return (
      <>
        <SiteHeader />
        <main className="crat-page">
          <section className="crat-section">
            {/* T9b дизайн-аудита: тот же кадр, что на /login/register — см. пояснение ниже. */}
            <div className="crat-shell auth-layout">
              <div>
                <SectionLabel kicker={t.invite.kicker} />
                <div className="crat-card accepted-card">
                  <h1 className="crat-display">{t.invite.invalidTitle}</h1>
                  <p className="crat-muted">{t.invite.invalidBody}</p>
                  <a className="crat-button primary" href={`mailto:${t.footer.contactEmail}`}>{t.invite.contactCta}</a>
                </div>
              </div>
              <div className="crat-visual-frame horizon crat-noise auth-frame-col" aria-hidden="true" />
            </div>
          </section>
        </main>
        <SiteFooter />
      </>
    )
  }

  const notice = signup === 'invalid' || signup === 'rate' || signup === 'already' ? signup : undefined

  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          {/* T9b дизайн-аудита (3 точечные правки): тот же вертикальный кадр, что на /login,
              /reset, 404 (auth-layout/auth-frame-col, components/site.css) — раньше правая
              колонка на ≥1024 пустовала. Форма первая в DOM (auth-frame-col aria-hidden), для
              клавиатуры/скринридера порядок логичный. */}
          <div className="crat-shell auth-layout">
            <div>
              <SectionLabel kicker={t.invite.kicker} />
              <h1 className="crat-display">{t.landing.signupTitle}</h1>
              <SignupForm returnTo={`/invite/${token}`} showTitle={false} notice={notice} inviteToken={token} />
            </div>
            <div className="crat-visual-frame horizon crat-noise auth-frame-col" aria-hidden="true" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
