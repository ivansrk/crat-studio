export function Download({
  file,
  children,
  assetBase,
}: {
  file: string
  children: React.ReactNode
  assetBase?: string
}) {
  return (
    <a className="mdx-download" href={`${assetBase ?? ''}/${file}`} download>
      ⬇ {children}
    </a>
  )
}
