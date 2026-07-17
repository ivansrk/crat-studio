import type { MdxComponentName } from '@/lib/content/whitelist'
import { Figure } from './Figure'
import { Gallery } from './Gallery'
import { Callout } from './Callout'
import { Video } from './Video'
import { Download } from './Download'
import { Trainer } from './Trainer'
import { Animation } from './Animation'
import { Divider } from './Divider'
import { Lead } from './Lead'
import { PullQuote } from './PullQuote'
import { KeyPoints } from './KeyPoints'
import { Sources } from './Sources'

type Props = Record<string, unknown>

const asProp = <P,>(component: React.ComponentType<P>) => component as React.ComponentType<Props>

/** fromLessonId (S5/D-051) прокидывается только со страницы урока — Trainer добавляет
 *  его в ссылку как ?from={lessonId}, чтобы страница тренажёра дала «Вернуться к уроку».
 *  На /articles аргумент не передаётся (Trainer там не встречается, но и без from ссылка валидна).
 *  Lead/PullQuote/KeyPoints/Sources (D-052) валидны только в статьях (ARTICLE_COMPONENTS);
 *  регистрируются всегда — валидатор не пускает их в уроки, так что коллизии нет. */
export function mdxComponents(assetBase: string, fromLessonId?: string): Record<MdxComponentName, React.ComponentType<Props>> {
  return {
    Figure: asProp((p: Parameters<typeof Figure>[0]) => <Figure {...p} assetBase={assetBase} />),
    Download: asProp((p: Parameters<typeof Download>[0]) => <Download {...p} assetBase={assetBase} />),
    Gallery: asProp(Gallery),
    Callout: asProp(Callout),
    Video: asProp(Video),
    Trainer: asProp((p: Parameters<typeof Trainer>[0]) => <Trainer {...p} fromLessonId={fromLessonId} />),
    Animation: asProp(Animation),
    Divider: asProp(Divider),
    Lead: asProp(Lead),
    PullQuote: asProp(PullQuote),
    KeyPoints: asProp(KeyPoints),
    Sources: asProp(Sources),
  }
}
