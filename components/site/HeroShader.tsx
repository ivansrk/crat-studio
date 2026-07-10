'use client'

import dynamic from 'next/dynamic'
import { useSyncExternalStore } from 'react'

// WebGL-шейдер грузим только на клиенте (ssr:false): библиотека рисует в canvas,
// на сервере ей делать нечего, а страница не должна зависеть от её SSR-поведения.
const GrainGradient = dynamic(
  () => import('@paper-design/shaders-react').then((m) => m.GrainGradient),
  { ssr: false },
)

const query = '(prefers-reduced-motion: reduce)'
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(query)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const getReduced = () => window.matchMedia(query).matches

/**
 * Шейдерный фон hero-секции (D-040, ТЗ Ивана 2026-07-10): зернистый градиент-волна.
 * Глобальный CSS-глушитель prefers-reduced-motion не действует на canvas-анимацию,
 * поэтому уважаем его вручную: reduce → speed 0 (статичный градиент, без мерцания).
 * Параметры (цвета/софтность/шум/форма) — из ТЗ дословно.
 */
export function HeroShader() {
  const reduced = useSyncExternalStore(subscribe, getReduced, () => false)
  return (
    <div className="hero-shader" aria-hidden="true">
      <GrainGradient
        style={{ width: '100%', height: '100%' }}
        colors={['#c6240c', '#bbe05c', '#193829']}
        colorBack="#0d0d0d"
        softness={0.7}
        intensity={0.15}
        noise={0.5}
        shape="wave"
        speed={reduced ? 0 : 1}
      />
    </div>
  )
}
