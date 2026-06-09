import type { ChatMessage, Source, StreamAlert } from '../types'
import { acquireBrowserSource, releaseBrowserSource } from './browserSourceManager'

export interface StreamEntry {
  sourceId: string
  stream: MediaStream | null
  video: HTMLVideoElement | null
  image: HTMLImageElement | null
}

export interface DrawSceneOptions {
  selectedSourceId?: string | null
  chatMessages?: ChatMessage[]
  activeAlerts?: StreamAlert[]
}

async function acquireDesktopCapture(captureId: string): Promise<HTMLVideoElement | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        // @ts-expect-error contraintes Electron desktopCapturer
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: captureId,
          maxFrameRate: 30
        }
      }
    })
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    await video.play()
    return video
  } catch {
    return null
  }
}

export async function acquireSourceStream(source: Source): Promise<StreamEntry> {
  const entry: StreamEntry = { sourceId: source.id, stream: null, video: null, image: null }

  if (source.type === 'screen' || source.type === 'window') {
    if (source.captureId) {
      const video = await acquireDesktopCapture(source.captureId)
      if (video) {
        entry.stream = video.srcObject as MediaStream
        entry.video = video
      }
    }
  } else if (source.type === 'display') {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const video = document.createElement('video')
      video.srcObject = stream
      video.muted = true
      await video.play()
      entry.stream = stream
      entry.video = video
    } catch { /* annulé */ }
  } else if (source.type === 'browser' && source.browserUrl) {
    return acquireBrowserSource(source.id, source.browserUrl)
  } else if (source.type === 'webcam') {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      const video = document.createElement('video')
      video.srcObject = stream
      video.muted = true
      await video.play()
      entry.stream = stream
      entry.video = video
    } catch { /* pas de caméra */ }
  } else if (source.type === 'image' && source.imageUrl) {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = source.imageUrl
    await new Promise((res) => { image.onload = res; image.onerror = res })
    entry.image = image
  }

  return entry
}

export function releaseSourceStream(sourceId: string, type: Source['type']): void {
  if (type === 'browser') releaseBrowserSource(sourceId)
}

const VIDEO_PLACEHOLDER_TYPES: Source['type'][] = ['display', 'screen', 'window', 'webcam', 'browser']

const BLEND_MAP: Record<NonNullable<Source['blendMode']>, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen'
}

function mediaDimensions(media: CanvasImageSource): { w: number; h: number } {
  if (media instanceof HTMLVideoElement) {
    return { w: media.videoWidth || 1, h: media.videoHeight || 1 }
  }
  if (media instanceof HTMLImageElement) {
    return { w: media.naturalWidth || 1, h: media.naturalHeight || 1 }
  }
  return { w: 1, h: 1 }
}

function drawMedia(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  source: Source
): void {
  const { w: mw, h: mh } = mediaDimensions(media)
  const scaleMode = source.scaleMode ?? 'stretch'
  let sx = 0
  let sy = 0
  let sw = mw
  let sh = mh
  let dx = x
  let dy = y
  let dw = w
  let dh = h

  if (scaleMode === 'fit' || scaleMode === 'fill') {
    const boxRatio = w / h
    const mediaRatio = mw / mh
    if (scaleMode === 'fit') {
      if (mediaRatio > boxRatio) {
        dh = w / mediaRatio
        dy = y + (h - dh) / 2
      } else {
        dw = h * mediaRatio
        dx = x + (w - dw) / 2
      }
    } else {
      if (mediaRatio > boxRatio) {
        sw = mh * boxRatio
        sx = (mw - sw) / 2
      } else {
        sh = mw / boxRatio
        sy = (mh - sh) / 2
      }
    }
  }

  ctx.save()
  ctx.globalCompositeOperation = BLEND_MAP[source.blendMode ?? 'normal']
  if (source.flipH || source.flipV) {
    ctx.translate(dx + dw / 2, dy + dh / 2)
    ctx.scale(source.flipH ? -1 : 1, source.flipV ? -1 : 1)
    ctx.drawImage(media, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh)
  } else {
    ctx.drawImage(media, sx, sy, sw, sh, dx, dy, dw, dh)
  }
  ctx.restore()
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  sources: Source[],
  streams: Map<string, StreamEntry>,
  options: DrawSceneOptions = {}
): void {
  const { selectedSourceId, chatMessages = [], activeAlerts = [] } = options

  const layers = sources
    .filter((s) => s.visible)
    .sort((a, b) => a.transform.zIndex - b.transform.zIndex)

  ctx.fillStyle = '#0a0a10'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (const source of layers) {
    const t = source.transform
    const dx = (t.x / 100) * canvas.width
    const dy = (t.y / 100) * canvas.height
    const dw = (t.width / 100) * canvas.width
    const dh = (t.height / 100) * canvas.height

    if (source.type === 'chat') {
      drawChatBox(ctx, dx, dy, dw, dh, chatMessages)
      continue
    }

    if (source.type === 'alert') {
      drawAlertBox(ctx, dx, dy, dw, dh, activeAlerts)
      continue
    }

    const entry = streams.get(source.id)

    if (entry?.video && entry.video.readyState >= 2) {
      drawMedia(ctx, entry.video, dx, dy, dw, dh, source)
    } else if (entry?.image?.complete && entry.image.naturalWidth > 0) {
      drawMedia(ctx, entry.image, dx, dy, dw, dh, source)
    } else if (source.type === 'text' && source.textContent) {
      drawTextBox(ctx, dx, dy, dw, dh, source.textContent)
    } else if (VIDEO_PLACEHOLDER_TYPES.includes(source.type)) {
      drawPlaceholder(ctx, dx, dy, dw, dh, source.name, source.captureName)
    }

    if (source.id === selectedSourceId) {
      ctx.strokeStyle = '#7c3aed'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(dx, dy, dw, dh)
      ctx.setLineDash([])
    }
  }
}

function drawTextBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  text: string
): void {
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${Math.max(14, h * 0.5)}px Segoe UI, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + w / 2, y + h / 2)
}

function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  name: string,
  subtitle?: string
): void {
  ctx.fillStyle = '#1a1a28'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#333'
  ctx.strokeRect(x, y, w, h)
  ctx.fillStyle = '#888'
  ctx.font = 'bold 13px Segoe UI, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, x + w / 2, y + h / 2 - (subtitle ? 8 : 0))
  if (subtitle) {
    ctx.fillStyle = '#555'
    ctx.font = '11px Segoe UI, sans-serif'
    ctx.fillText(subtitle, x + w / 2, y + h / 2 + 10)
  }
}

function drawChatBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  messages: ChatMessage[]
): void {
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#c4b5fd'
  ctx.font = `bold ${Math.max(10, h * 0.07)}px Segoe UI, sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText('CHAT', x + 8, y + h * 0.1)

  const recent = messages.slice(-6)
  const lineH = Math.max(12, h * 0.12)
  ctx.font = `${Math.max(10, h * 0.065)}px Segoe UI, sans-serif`
  recent.forEach((msg, i) => {
    ctx.fillStyle = msg.color ?? '#ddd'
    const text = `${msg.username}: ${msg.message}`.slice(0, 48)
    ctx.fillText(text, x + 8, y + h * 0.22 + i * lineH)
  })
}

function drawAlertBox(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  alerts: StreamAlert[]
): void {
  const alert = alerts[alerts.length - 1]
  if (!alert) return

  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#c4b5fd'
  ctx.font = `bold ${Math.max(12, h * 0.25)}px Segoe UI, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(alert.username, x + w / 2, y + h * 0.4)
  ctx.font = `${Math.max(10, h * 0.15)}px Segoe UI, sans-serif`
  ctx.fillStyle = '#fff'
  ctx.fillText(alert.message ?? alert.type, x + w / 2, y + h * 0.65)
}
