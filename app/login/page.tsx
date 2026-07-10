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
          {/* T7 дизайн-аудита (Б.10): узкий вертикальный кадр справа (десктоп ≥1024) —
              чистый CSS (crat-visual-frame.horizon + crat-noise), формы не трогаем. */}
          <div className="crat-shell auth-layout">
            <div>
              <SectionLabel kicker={t.auth.kicker} />
              <h1 className="crat-display">{t.auth.title}</h1>
              <LoginForm />
            </div>
            <div className="crat-visual-frame horizon crat-noise auth-frame-col" aria-hidden="true" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
