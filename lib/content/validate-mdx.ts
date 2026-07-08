import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import { visit } from 'unist-util-visit'
import { MDX_COMPONENTS, TRAINER_IDS, FORBIDDEN_HTML } from './whitelist'

export type MdxValidationCtx = { existingAssets: Set<string>; animationIds: Set<string> }

type MdxJsxAttribute = {
  type: string
  name: string
  value?: string | { type: string; value?: string }
}

/** Возвращает список ошибок (пустой = валидно). Правила: content-format.md §4, §6; LES-15. Никогда не бросает. */
export function validateMdx(src: string, ctx: MdxValidationCtx): string[] {
  const errors: string[] = []
  let tree: unknown
  try {
    tree = remark().use(remarkMdx).parse(src)
  } catch (e) {
    return [`MDX не парсится: ${(e as Error).message}`]
  }

  const whitelist = new Set<string>(MDX_COMPONENTS)

  /**
   * Возвращает строковое значение атрибута, либо ошибку, если атрибут — это
   * JS-выражение (`src={dyn}`) вместо строкового литерала. Такие выражения
   * запрещены (см. правило про {…}), поэтому они не должны молча проходить
   * дальше как «пустое» или «валидное» значение.
   */
  const attr = (node: any, name: string): { value?: string; isExpression: boolean } => {
    const found = (node.attributes as MdxJsxAttribute[] | undefined)?.find(
      (a) => a.type === 'mdxJsxAttribute' && a.name === name
    )
    if (!found) return { isExpression: false }
    if (typeof found.value === 'string' || found.value === undefined) {
      return { value: found.value, isExpression: false }
    }
    // mdxJsxAttributeValueExpression — значение задано JS-выражением
    return { isExpression: true }
  }

  visit(tree as any, (node: any) => {
    switch (node.type) {
      case 'mdxjsEsm':
        errors.push('import/export (JS) в уроке запрещены')
        break
      case 'mdxFlowExpression':
      case 'mdxTextExpression':
        errors.push(`JS-выражение {${node.value}} запрещено`)
        break
      case 'html':
        if (FORBIDDEN_HTML.test(node.value)) errors.push(`запрещённый HTML-тег: ${node.value.slice(0, 40)}`)
        break
      case 'image':
        if (!ctx.existingAssets.has(node.url)) errors.push(`картинка ссылается на несуществующий файл: ${node.url}`)
        break
      case 'mdxJsxFlowElement':
      case 'mdxJsxTextElement': {
        const name = node.name ?? ''
        if (!whitelist.has(name)) {
          errors.push(`компонент вне белого списка: <${name || '(фрагмент)'}>`)
          break
        }
        if (name === 'Trainer') {
          const id = attr(node, 'id')
          if (id.isExpression) errors.push('<Trainer id={...}> — JS-выражение в атрибуте запрещено')
          else if (!id.value || !(TRAINER_IDS as readonly string[]).includes(id.value))
            errors.push(`<Trainer id="${id.value}"> — неизвестный тренажёр`)
        }
        if (name === 'Animation') {
          const id = attr(node, 'id')
          if (id.isExpression) errors.push('<Animation id={...}> — JS-выражение в атрибуте запрещено')
          else if (!id.value || !ctx.animationIds.has(id.value))
            errors.push(`<Animation id="${id.value}"> — нет в библиотеке анимаций`)
        }
        if (name === 'Figure' || name === 'Download') {
          const attrName = name === 'Figure' ? 'src' : 'file'
          const file = attr(node, attrName)
          if (file.isExpression) errors.push(`<${name} ${attrName}={...}> — JS-выражение в атрибуте запрещено`)
          else if (file.value && file.value !== 'cheatsheet.pdf' && !ctx.existingAssets.has(file.value))
            errors.push(`<${name}> ссылается на несуществующий файл: ${file.value}`)
        }
        break
      }
    }
  })
  return errors
}
