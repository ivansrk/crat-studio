import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import { visit } from 'unist-util-visit'
import { MDX_COMPONENTS, TRAINER_IDS } from './whitelist'

export type MdxValidationCtx = { existingAssets: Set<string>; animationIds: Set<string> }

type MdxJsxAttribute = {
  type: string
  name: string
  // string — обычный атрибут; null — boolean-shorthand (`disabled`);
  // объект — mdxJsxAttributeValueExpression (`src={...}`)
  value?: string | null | { type: string; value?: string }
}

/** Обязательные строковые пропы компонентов; отсутствие — ошибка. */
const REQUIRED_ATTRS: Record<string, string> = {
  Figure: 'src',
  Download: 'file',
  Trainer: 'id',
  Animation: 'id',
}

/** Единственный файл, который Download может указывать вне assets/ (генерируется отдельно). */
const DOWNLOAD_CHEATSHEET = 'cheatsheet.pdf'

const EXTERNAL_URL = /^(https?:)?\/\//i

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
   * Строковое значение атрибута, если он присутствует и задан строковым
   * литералом. Выражения и valueless-атрибуты уже отсечены generic-сканом,
   * поэтому здесь их пропускаем (undefined), не дублируя ошибку.
   */
  const strAttr = (node: any, name: string): { present: boolean; value?: string } => {
    const found = (node.attributes as MdxJsxAttribute[] | undefined)?.find(
      (a) => a.type === 'mdxJsxAttribute' && a.name === name
    )
    if (!found) return { present: false }
    return { present: true, value: typeof found.value === 'string' ? found.value : undefined }
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
      // Ветки 'html' нет намеренно: remark-mdx парсит ЛЮБОЙ тег (включая
      // <script>/<iframe>/<style>/<b>) как mdxJsx*Element, и такие теги
      // режутся ниже проверкой белого списка (D-018).
      case 'image':
        if (EXTERNAL_URL.test(node.url)) errors.push(`внешние URL запрещены — только файлы из assets/: ${node.url}`)
        else if (!ctx.existingAssets.has(node.url)) errors.push(`картинка ссылается на несуществующий файл: ${node.url}`)
        break
      case 'mdxJsxFlowElement':
      case 'mdxJsxTextElement': {
        const name = node.name ?? ''
        if (!whitelist.has(name)) {
          errors.push(`компонент вне белого списка: <${name || '(фрагмент)'}>`)
          break
        }
        // Произвольный JS запрещён на ЛЮБОМ компоненте: атрибут-выражение
        // (foo={...}) и spread ({...props}) — ошибка, а не молчаливый пропуск.
        // Boolean-shorthand (value: null) — тоже вне контракта, но это не JS.
        for (const a of (node.attributes ?? []) as MdxJsxAttribute[]) {
          if (a.type === 'mdxJsxExpressionAttribute') {
            errors.push(`JS-выражение в атрибуте <${name}> запрещено: {...}`)
          } else if (a.value === null) {
            errors.push(`атрибут ${a.name} без значения недопустим в <${name}>`)
          } else if (a.value !== undefined && typeof a.value !== 'string') {
            errors.push(`JS-выражение в атрибуте <${name}> запрещено: ${a.name}={...}`)
          }
        }
        const required = REQUIRED_ATTRS[name]
        if (required) {
          const a = strAttr(node, required)
          if (!a.present) {
            errors.push(`<${name}> без обязательного атрибута ${required}`)
            break
          }
          if (a.value === undefined) break // выражение/valueless — ошибка уже выше
          if (name === 'Trainer' && !(TRAINER_IDS as readonly string[]).includes(a.value))
            errors.push(`<Trainer id="${a.value}"> — неизвестный тренажёр`)
          if (name === 'Animation' && !ctx.animationIds.has(a.value))
            errors.push(`<Animation id="${a.value}"> — нет в библиотеке анимаций`)
          if (name === 'Figure' && !ctx.existingAssets.has(a.value))
            errors.push(`<Figure> ссылается на несуществующий файл: ${a.value}`)
          if (name === 'Download' && a.value !== DOWNLOAD_CHEATSHEET && !ctx.existingAssets.has(a.value))
            errors.push(`<Download> ссылается на несуществующий файл: ${a.value}`)
        }
        break
      }
    }
  })
  return errors
}
