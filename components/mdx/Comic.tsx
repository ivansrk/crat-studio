/** Комикс (контракт v2.2, D-055/LES-17): children — только <Figure>, страницы встык. */
export function Comic({ children }: { children: React.ReactNode }) {
  return <div className="mdx-comic">{children}</div>
}
