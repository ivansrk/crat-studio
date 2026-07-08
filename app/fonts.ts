import { Cormorant_Garamond, Manrope, JetBrains_Mono } from 'next/font/google'

export const accent = Cormorant_Garamond({ subsets: ['cyrillic', 'latin'], weight: ['500', '700'], variable: '--font-accent' })
export const body = Manrope({ subsets: ['cyrillic', 'latin'], variable: '--font-body' })
export const mono = JetBrains_Mono({ subsets: ['cyrillic', 'latin'], variable: '--font-mono' })
