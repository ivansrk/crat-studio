import Image from 'next/image'
import { t } from '@/lib/i18n'

/**
 * Киноэкран героя (бриф §7.2/§8, обновлено Ф7в/D-038): сгенерированная
 * картинка внутри существующей CSS-рамки — поверх остаются зерно (.crat-noise),
 * красное свечение рамки, неоновый горизонт (.horizon/.neon-line) и медленный
 * сдвиг фонового свечения (.hero-visual-glow, DSN-05). Используется на главной
 * (hero-home.webp) и на лендинге курса (hero-course.webp, тот же приём).
 * Картинка декоративная (alt="") — подпись дублирует header.sub и уже
 * озвучена скринридером, поэтому весь блок aria-hidden.
 */
export function HeroVisual({ src = '/images/hero-home.webp' }: { src?: string }) {
  return (
    <div
      className="crat-visual-frame horizon neon-line crat-noise crat-frame-gradient hero-visual"
      aria-hidden="true"
    >
      <Image
        src={src}
        alt=""
        fill
        priority
        sizes="(max-width: 860px) 100vw, 45vw"
        className="crat-frame-img"
      />
      <span className="hero-visual-glow" aria-hidden="true" />
      <span className="crat-kicker hero-visual-mark">{t.header.sub}</span>
    </div>
  )
}
