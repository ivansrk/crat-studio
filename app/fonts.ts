import { Cormorant_Garamond, Manrope, JetBrains_Mono } from 'next/font/google'

// T6 дизайн-аудита: italic-начертание подключено (лид статьи — T7, .crat-em ниже).
export const accent = Cormorant_Garamond({ subsets: ['cyrillic', 'latin'], weight: ['500', '700'], style: ['normal', 'italic'], variable: '--font-accent' })
export const body = Manrope({ subsets: ['cyrillic', 'latin'], variable: '--font-body' })
export const mono = JetBrains_Mono({ subsets: ['cyrillic', 'latin'], variable: '--font-mono' })
