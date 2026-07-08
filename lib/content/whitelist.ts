export const MDX_COMPONENTS = ['Figure', 'Gallery', 'Callout', 'Video', 'Download', 'Trainer', 'Animation', 'Divider'] as const
export type MdxComponentName = (typeof MDX_COMPONENTS)[number]
export const TRAINER_IDS = ['t1', 't2', 't3'] as const
