import { Theme } from '@material/material-color-utilities'

import { atom } from '../../atom'

const themeAtom = atom<Theme | undefined>(undefined)

export function useTheme() {
  return themeAtom.use()
}

export function useSetTheme() {
  return themeAtom.set
}
