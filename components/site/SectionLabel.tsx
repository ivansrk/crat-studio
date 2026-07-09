/**
 * Эйбраз секции (бриф §6): mono-kicker + короткая красная линия.
 * Ставится над h2 крупных секций редакционного монтажа главной (Task 4).
 */
export function SectionLabel({ kicker }: { kicker: string }) {
  return (
    <div className="section-label">
      <span className="crat-kicker">{kicker}</span>
      <span className="crat-red-line" aria-hidden="true" />
    </div>
  )
}
