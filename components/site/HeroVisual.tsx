import { t } from '@/lib/i18n'

/**
 * CSS-«киноэкран» героя главной (бриф §7.2): красное свечение, зерно, неоновая
 * линия-горизонт — без картинок/стоков (бриф §13). Чисто декоративный блок,
 * скрыт от скринридеров: подпись внутри дублирует уже озвученный header.sub.
 */
export function HeroVisual() {
  return (
    <div className="crat-visual-frame horizon neon-line crat-noise hero-visual" aria-hidden="true">
      <span className="crat-kicker hero-visual-mark">{t.header.sub}</span>
    </div>
  )
}
