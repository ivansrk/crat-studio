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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${assetBase ?? ''}/${src}`} alt={caption ?? ''} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
