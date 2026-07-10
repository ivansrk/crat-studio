import { LoginForm } from './LoginForm'
import { t } from '@/lib/i18n'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SectionLabel } from '@/components/site/SectionLabel'

// T6 (Ф7а, D-031): вход по паролю (F10) — заменяет прежнюю форму «получить ссылку входа» (magic link, снят).
export default function Login() {
  return (
    <>
      <SiteHeader />
      <main className="crat-page">
        <section className="crat-section">
          <div className="crat-shell">
            <SectionLabel kicker={t.auth.kicker} />
            <h1 className="crat-display">{t.auth.title}</h1>
            <LoginForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
