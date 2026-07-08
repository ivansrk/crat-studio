import { describe, it, expect } from 'vitest'
import { validateMdx } from './validate-mdx'

const ANIMS = ['neon-pulse', 'float-up']
const ok = (src: string, assets: string[] = []) =>
  validateMdx(src, { existingAssets: new Set(assets), animationIds: new Set(ANIMS) })

describe('validateMdx', () => {
  it('обычный markdown + компоненты белого списка — ок', () => {
    const r = ok('## Заголовок\n\n<Callout type="idea">Мысль</Callout>\n\n<Divider />')
    expect(r).toHaveLength(0)
  })
  it('import/export запрещены', () => {
    expect(ok('import x from "y"\n\nтекст').join()).toMatch(/import|export|JS/i)
  })
  it('JS-выражения {…} запрещены', () => {
    expect(ok('Счёт: {1 + 1}').join()).toMatch(/выражен/i)
  })
  it('компонент вне белого списка — ошибка', () => {
    expect(ok('<Hacker />').join()).toMatch(/Hacker/)
  })
  it('script/iframe/style в raw HTML — ошибка', () => {
    expect(ok('<script>alert(1)</script>').join()).toMatch(/script/i)
  })
  it('Trainer с неизвестным id — ошибка', () => {
    expect(ok('<Trainer id="t9" />').join()).toMatch(/t9/)
  })
  it('Animation с неизвестным id — ошибка; с известным — ок', () => {
    expect(ok('<Animation id="wat" />').join()).toMatch(/wat/)
    expect(ok('<Animation id="neon-pulse" />')).toHaveLength(0)
  })
  it('Figure/Download/![…] на несуществующий asset — ошибка; на существующий — ок', () => {
    expect(ok('<Figure src="assets/no.png" />').join()).toMatch(/no\.png/)
    expect(ok('<Figure src="assets/yes.png" />', ['assets/yes.png'])).toHaveLength(0)
    expect(ok('![схема](assets/no2.png)').join()).toMatch(/no2\.png/)
  })
  it('битый MDX-синтаксис — ошибка, не исключение', () => {
    expect(ok('<Callout>').length).toBeGreaterThan(0)
  })
  it('атрибут-выражение (JS) вместо строки — ошибка, не проходит молча', () => {
    expect(ok('<Figure src={dyn} />').length).toBeGreaterThan(0)
  })
  it('атрибут-выражение на компоненте без спец-проверки — ошибка', () => {
    expect(ok('<Video kinescope={x} />').length).toBeGreaterThan(0)
  })
  it('spread-атрибут {...props} — ошибка', () => {
    expect(ok('<Callout {...props}>x</Callout>').length).toBeGreaterThan(0)
  })
  it('Figure без обязательного src — ошибка', () => {
    expect(ok('<Figure />').join()).toMatch(/src/)
  })
  it('Download без обязательного file — ошибка', () => {
    expect(ok('<Download>x</Download>').join()).toMatch(/file/)
  })
  it('Trainer/Animation без id — ошибка про обязательный атрибут, не «id="undefined"»', () => {
    expect(ok('<Trainer />').join()).toMatch(/обязательн.*id/i)
    expect(ok('<Animation />').join()).toMatch(/обязательн.*id/i)
    expect(ok('<Trainer />').join()).not.toMatch(/undefined/)
  })
  it('valueless-атрибут (boolean shorthand) — ошибка, но не про JS-выражение', () => {
    const msgs = ok('<Trainer id="t1" disabled />').join()
    expect(msgs).toMatch(/disabled/)
    expect(msgs).not.toMatch(/JS-выражен/i)
  })
  it('внешний URL картинки — ошибка про внешние URL, не «несуществующий файл»', () => {
    const msgs = ok('![x](https://evil.example/pic.png)').join()
    expect(msgs).toMatch(/внешн/i)
    expect(msgs).not.toMatch(/несуществующ/i)
  })
  it('Video без обязательного kinescope — ошибка', () => {
    expect(ok('<Video />').join()).toMatch(/kinescope/)
    expect(ok('<Video kinescope="abc123" />')).toHaveLength(0)
  })
  it('Callout с недопустимым type — ошибка; без type или с валидным — ок', () => {
    expect(ok('<Callout type="danger">x</Callout>').join()).toMatch(/недопустимый type у <Callout>/)
    expect(ok('<Callout>x</Callout>')).toHaveLength(0)
    expect(ok('<Callout type="idea">x</Callout>')).toHaveLength(0)
    expect(ok('<Callout type="warning">x</Callout>')).toHaveLength(0)
    expect(ok('<Callout type="example">x</Callout>')).toHaveLength(0)
  })
  it('cheatsheet.pdf — исключение только для Download, Figure проверяется как обычно', () => {
    expect(ok('<Download file="cheatsheet.pdf">чек-лист</Download>')).toHaveLength(0)
    expect(ok('<Figure src="cheatsheet.pdf" />').join()).toMatch(/cheatsheet\.pdf/)
  })
})
