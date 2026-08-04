import { useEffect } from 'react'

import { atom } from '../atom'

const mobileAtom = atom<boolean | undefined>(undefined)

let listened = false

export function useMobile() {
  const [mobile, setMobile] = mobileAtom.useState()

  useEffect(() => {
    if (listened) return
    listened = true

    const mq = window.matchMedia('(max-width: 640px)')
    setMobile(mq.matches)
    mq.addEventListener('change', (e) => {
      setMobile(e.matches)
    })
  }, [setMobile])

  return mobile
}
