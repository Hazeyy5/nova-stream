type AlertGifEntry =
  | { kind: 'video'; video: HTMLVideoElement }
  | { kind: 'image'; image: HTMLImageElement }

const cache = new Map<string, AlertGifEntry>()

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm)(\?|$)/i.test(url)
}

/** Giphy sert souvent le même asset en .gif et .mp4 — le MP4 s'anime sur canvas. */
export function giphyGifToMp4(url: string): string | null {
  if (!/giphy\.com/i.test(url) || isVideoUrl(url)) return null
  if (!/\.gif(\?|$)/i.test(url)) return null
  return url.replace(/\.gif(\?.*)?$/i, '.mp4$1')
}

function resolvePlaybackUrl(url: string): string {
  if (isVideoUrl(url)) return url
  return giphyGifToMp4(url) ?? url
}

function createVideo(src: string): HTMLVideoElement {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.src = src
  video.muted = true
  video.loop = true
  video.playsInline = true
  video.preload = 'auto'
  void video.play().catch(() => {})
  return video
}

function loadEntry(url: string): AlertGifEntry {
  const playbackUrl = resolvePlaybackUrl(url)
  if (isVideoUrl(playbackUrl) || giphyGifToMp4(url)) {
    return { kind: 'video', video: createVideo(playbackUrl) }
  }
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.src = url
  return { kind: 'image', image }
}

export function getAlertGifMedia(url?: string): CanvasImageSource | null {
  const trimmed = url?.trim()
  if (!trimmed) return null

  let entry = cache.get(trimmed)
  if (!entry) {
    entry = loadEntry(trimmed)
    cache.set(trimmed, entry)
  }

  if (entry.kind === 'video') {
    const video = entry.video
    if (video.paused) void video.play().catch(() => {})
    if (video.readyState >= 2) return video
    if (video.readyState >= 1) return video
    return null
  }

  const image = entry.image
  if (!image.complete || image.naturalWidth <= 0) return null
  return image
}

export function preloadAlertGif(url?: string): void {
  getAlertGifMedia(url)
}
