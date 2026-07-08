import type { MdxComponentName } from '@/lib/content/whitelist'
import { Figure } from './Figure'
import { Gallery } from './Gallery'
import { Callout } from './Callout'
import { Video } from './Video'
import { Download } from './Download'
import { Trainer } from './Trainer'
import { Animation } from './Animation'
import { Divider } from './Divider'

type Props = Record<string, unknown>

const asProp = <P,>(component: React.ComponentType<P>) => component as React.ComponentType<Props>

export function mdxComponents(assetBase: string): Record<MdxComponentName, React.ComponentType<Props>> {
  return {
    Figure: asProp((p: Parameters<typeof Figure>[0]) => <Figure {...p} assetBase={assetBase} />),
    Download: asProp((p: Parameters<typeof Download>[0]) => <Download {...p} assetBase={assetBase} />),
    Gallery: asProp(Gallery),
    Callout: asProp(Callout),
    Video: asProp(Video),
    Trainer: asProp(Trainer),
    Animation: asProp(Animation),
    Divider: asProp(Divider),
  }
}
