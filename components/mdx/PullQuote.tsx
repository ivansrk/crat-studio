/** D-052: вынесенная цитата — крупный serif + красная кавычка-свет (приём blockquote
 *  урока, крупнее и с выходом за колонку на десктопе). Только для /articles (§8 v2.1).
 *  cite — опциональная атрибуция под цитатой (тихий mono). */
export function PullQuote({
  children,
  cite,
}: {
  children: React.ReactNode
  cite?: string
}) {
  return (
    <figure className="mdx-pullquote">
      <blockquote>{children}</blockquote>
      {cite && <figcaption>{cite}</figcaption>}
    </figure>
  )
}
