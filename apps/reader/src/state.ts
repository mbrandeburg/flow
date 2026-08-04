import { RenditionSpread } from '@flow/epubjs/types/rendition'

import { atom, persistedAtom } from './atom'

const navbar = atom<boolean>(false)

export function useNavbar() {
  return navbar.useState()
}

export function useSetNavbar() {
  return navbar.set
}

export interface Settings extends TypographyConfiguration {
  theme?: ThemeConfiguration
  enableTextSelectionMenu?: boolean
}

export interface TypographyConfiguration {
  fontSize?: string
  fontWeight?: number
  fontFamily?: string
  lineHeight?: number
  spread?: RenditionSpread
  zoom?: number
}

interface ThemeConfiguration {
  source?: string
  background?: number
}

export const defaultSettings: Settings = {}

const settings = persistedAtom<Settings>('settings', defaultSettings)

export function useSettings() {
  return settings.useState()
}
