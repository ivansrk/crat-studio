'use client'

import dynamic from 'next/dynamic'
import { useSyncExternalStore } from 'react'

// Тот же приём, что HeroShader (D-040): WebGL-компоненты грузим только на
// клиенте (ssr:false) — canvas им рисовать негде и незачем на сервере.
const GrainGradient = dynamic(
  () => import('@paper-design/shaders-react').then((m) => m.GrainGradient),
  { ssr: false },
)
const Dithering = dynamic(
  () => import('@paper-design/shaders-react').then((m) => m.Dithering),
  { ssr: false },
)
const GodRays = dynamic(
  () => import('@paper-design/shaders-react').then((m) => m.GodRays),
  { ssr: false },
)

const query = '(prefers-reduced-motion: reduce)'
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(query)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const getReduced = () => window.matchMedia(query).matches

export type SectionShaderVariant = 'contact-ripple' | 'consult-blob' | 'course-dither' | 'celebrate-rays'

/**
 * Шейдеры-эхо (D-042, дизайн-аудит T2): повторяют приём HeroShader в четырёх
 * более тихих точках сайта (dynamic ssr:false, reduced-motion → speed 0
 * вручную — глобальный CSS-глушитель на canvas не действует, aria-hidden,
 * absolute inset-0 за контентом, pointer-events none — см. site.css
 * .section-shader/.shader-scope/.shader-content).
 *
 * Параметры зашиты внутри по variant — страница передаёт только его, конфиги
 * не размазаны по страницам:
 * - contact-ripple — главная #contact, GrainGradient(ripple), тише hero-волны.
 * - consult-blob   — /consult, GrainGradient(blob), только над формой.
 * - course-dither  — /ai-basics hero, Dithering(ripple), за текстовой половиной.
 * - celebrate-rays — квиз «сдан» и валидный /cert, GodRays(linear-пресет).
 */
export function SectionShader({ variant }: { variant: SectionShaderVariant }) {
  const reduced = useSyncExternalStore(subscribe, getReduced, () => false)
  const className = `section-shader section-shader--${variant}`
  const style = { width: '100%', height: '100%' } as const

  if (variant === 'contact-ripple') {
    return (
      <div className={className} aria-hidden="true">
        <GrainGradient
          style={style}
          shape="ripple"
          colors={['#c6240c', '#193829']}
          colorBack="#0d0d0d"
          intensity={0.08}
          softness={0.8}
          noise={0.4}
          speed={reduced ? 0 : 0.5}
        />
      </div>
    )
  }

  if (variant === 'consult-blob') {
    return (
      <div className={className} aria-hidden="true">
        <GrainGradient
          style={style}
          shape="blob"
          colors={['#B11212', '#193829']}
          colorBack="#0d0d0d"
          intensity={0.07}
          softness={0.7}
          noise={0.4}
          speed={reduced ? 0 : 0.4}
        />
      </div>
    )
  }

  if (variant === 'course-dither') {
    // Dithering не умеет intensity/несколько цветов (colorFront — один тон) —
    // «низкую интенсивность» из ТЗ держит opacity обёртки (.section-shader--course-dither, site.css).
    return (
      <div className={className} aria-hidden="true">
        <Dithering
          style={style}
          shape="ripple"
          type="4x4"
          size={6}
          colorFront="#4A0909"
          colorBack="#0d0d0d"
          speed={reduced ? 0 : 0.2}
        />
      </div>
    )
  }

  // celebrate-rays — GodRays, geometry/offset те же, что у linear-пресета
  // библиотеки, цвета/bloom/intensity — из ТЗ (красный+лайм, тише героя).
  return (
    <div className={className} aria-hidden="true">
      <GodRays
        style={style}
        colorBack="#000000"
        colorBloom="#c6240c"
        colors={['rgba(255,75,58,.5)', 'rgba(187,224,92,.25)']}
        offsetX={0.2}
        offsetY={-0.8}
        density={0.45}
        spotty={0.25}
        midSize={0.1}
        midIntensity={0.75}
        intensity={0.3}
        bloom={0.4}
        speed={reduced ? 0 : 0.6}
      />
    </div>
  )
}
