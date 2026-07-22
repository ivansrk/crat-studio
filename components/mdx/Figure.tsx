export function Figure({
  src,
  caption,
  assetBase,
}: {
  src: string
  caption?: string
  assetBase?: string
}) {
  return (
    <figure className="mdx-figure">
      {/* alt="" всегда: при caption текст даёт figcaption (без дублирования), без caption картинка декоративная */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${assetBase ?? ''}/${src}`} alt="" loading="lazy" />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
