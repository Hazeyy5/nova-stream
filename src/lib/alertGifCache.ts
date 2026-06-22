const cache = new Map<string, HTMLImageElement>()

export function getAlertGif(url?: string): HTMLImageElement | null {
  const trimmed = url?.trim()
  if (!trimmed) return null

  let img = cache.get(trimmed)
  if (!img) {
    img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = trimmed
    cache.set(trimmed, img)
  }

  if (!img.complete || img.naturalWidth <= 0) return null
  return img
}

export function preloadAlertGif(url?: string): void {
  if (!url?.trim()) return
  getAlertGif(url)
}
