import { atom } from '../atom'

export type Action =
  | 'toc'
  | 'search'
  | 'annotation'
  | 'typography'
  | 'image'
  | 'timeline'
  | 'theme'

const action = atom<Action | undefined>(undefined)

export function useSetAction() {
  return action.set
}

export function useAction() {
  return action.useState()
}
