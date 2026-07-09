import { describe, it, expect } from 'vitest'
import { safeJsonLd } from './JsonLd'

describe('safeJsonLd', () => {
  it('экранирует < — </script> в данных не может прервать ld+json-тег (XSS, ревью T3)', () => {
    const data = { headline: 'Заголовок с </script><script>alert(1)</script> внутри' }
    const out = safeJsonLd(data)
    expect(out).not.toContain('</')
    expect(out).not.toContain('<')
    // экранирование не ломает данные: JSON.parse восстанавливает исходник
    expect(JSON.parse(out)).toEqual(data)
  })

  it('обычные данные сериализует как JSON.stringify', () => {
    const data = { '@context': 'https://schema.org', '@type': 'Organization', name: 'CRAT studio' }
    expect(safeJsonLd(data)).toBe(JSON.stringify(data))
    expect(JSON.parse(safeJsonLd(data))).toEqual(data)
  })
})
