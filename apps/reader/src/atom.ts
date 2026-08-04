import { IS_SERVER } from '@literal-ui/hooks'
import { proxy, subscribe, useSnapshot } from 'valtio'

type Updater<T> = T | ((prev: T) => T)

export interface Atom<T> {
  proxy: { value: T }
  get(): T
  set(updater: Updater<T>): void
  use(): T
  useState(): [T, (updater: Updater<T>) => void]
}

export function atom<T>(initial: T): Atom<T> {
  const state = proxy<{ value: T }>({ value: initial })
  const set = (updater: Updater<T>) => {
    state.value =
      typeof updater === 'function'
        ? (updater as (prev: T) => T)(state.value)
        : updater
  }
  function useValue(): T {
    return useSnapshot(state).value as T
  }
  function useAtomState(): [T, (updater: Updater<T>) => void] {
    return [useValue(), set]
  }
  return {
    proxy: state,
    get: () => state.value,
    set,
    use: useValue,
    useState: useAtomState,
  }
}

export function persistedAtom<T>(key: string, initial: T): Atom<T> {
  const a = atom<T>(initial)
  if (!IS_SERVER) {
    const saved = localStorage.getItem(key)
    if (saved === null) {
      localStorage.setItem(key, JSON.stringify(initial))
    } else {
      a.proxy.value = JSON.parse(saved)
    }
    subscribe(a.proxy, () => {
      localStorage.setItem(key, JSON.stringify(a.proxy.value))
    })
  }
  return a
}
