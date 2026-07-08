import { ANIMATIONS } from '@/lib/design/animations/registry'

export function Animation({ id, children }: { id: string; children?: React.ReactNode }) {
  return <span className={ANIMATIONS[id] ?? ''}>{children ?? '✳'}</span>
}
