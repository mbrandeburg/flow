export function keys<T extends object>(o: T) {
  return Object.keys(o) as (keyof T)[]
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function last<T>(array: T[]) {
  return array[array.length - 1]
}

export function group<T>(array: T[], getKey: (item: T) => string | number) {
  const o: Record<string, T[]> = {}

  array.forEach((item) => {
    const key = getKey(item)
    o[key] = [...(o[key] ?? []), item]
  })

  return o
}

export function copy(text: string) {
  return navigator.clipboard.writeText(text)
}

export function download(text: string, filename: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revocation so the download has a chance to start in all browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
