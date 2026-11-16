import type { Lang } from '../engine/types'
import { en } from './en'
import { fr, type Key } from './fr'

export type { Key }
export const dictionaries: Record<Lang, Record<Key, string>> = { fr, en }
