import type { ChatMessage, Source, StreamAlert, WidgetLiveData } from '../types'
import { acquireBrowserSource, releaseBrowserSource } from './browserSourceManager'
import { drawWithChromaKey } from './chromaKey'
import { drawChatBox } from './chatBoxRenderer'
import { drawAlertBox } from './alertBoxRenderer'
import {
  drawFollowerGoalWidget,
  drawPollWidget,
  drawSubGoalWidget,
  drawViewerCountWidget
} from './widgetRenderer'
import { DEFAULT_WIDGET_LIVE_DATA } from '../types'

async function loadImageSource(source: Source): Promise<HTMLImageElement | null> {
  let src = source.imageUrl?.trim() ?? ''
  if (source.imageLocalPath) {
    try {
      const dataUrl = await window.novaStream.dialog.readImageFile(source.imageLocalPath)
      if (dataUrl) src = dataUrl
    } catch {
      /* ignore */
    }
  }
  if (!src) return null

  const image = new Image()
  if (src.startsWith('http://') || src.startsWith('https://')) {
    image.crossOrigin = 'anonymous'
  }
  image.src = src
  await new Promise((res) => { image.onload = res; image.onerror = res })
  if (!image.complete || image.naturalWidth <= 0) return null
  return image
}

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
  frameTime?: number
  widgetLiveData?: WidgetLiveData
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
    video.playsInline = true
    video.disablePictureInPicture = true
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
      video.playsInline = true
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
      video.playsInline = true
      await video.play()
      entry.stream = stream
      entry.video = video
    } catch { /* pas de caméra */ }
  } else if (source.type === 'image' && (source.imageUrl || source.imageLocalPath)) {
    const image = await loadImageSource(source)
    if (image) entry.image = image
  }

  return entry
}

export function releaseSourceStream(sourceId: string, type: Source['type']): void {
  if (type === 'browser') releaseBrowserSource(sourceId)
}

const VIDEO_PLACEHOLDER_TYPES = new Set<Source['type']>(['display', 'screen', 'window', 'webcam', 'browser'])

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

  const chroma = source.chromaKey?.enabled ? source.chromaKey : null

  ctx.save()
  ctx.globalCompositeOperation = BLEND_MAP[source.blendMode ?? 'normal']
  if (source.flipH || source.flipV) {
    ctx.translate(dx + dw / 2, dy + dh / 2)
    ctx.scale(source.flipH ? -1 : 1, source.flipV ? -1 : 1)
    if (chroma) {
      drawWithChromaKey(ctx, media, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh, chroma)
    } else {
      ctx.drawImage(media, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh)
    }
  } else if (chroma) {
    drawWithChromaKey(ctx, media, sx, sy, sw, sh, dx, dy, dw, dh, chroma)
  } else {
    ctx.drawImage(media, sx, sy, sw, sh, dx, dy, dw, dh)
  }
  ctx.restore()
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  layers: Source[],
  streams: Map<string, StreamEntry>,
  options: DrawSceneOptions = {}
): void {
  const { selectedSourceId, chatMessages = [], activeAlerts = [], frameTime = Date.now(), widgetLiveData = DEFAULT_WIDGET_LIVE_DATA } = options

  ctx.fillStyle = '#0a0a10'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (const source of layers) {
    const t = source.transform
    const dx = (t.x / 100) * canvas.width
    const dy = (t.y / 100) * canvas.height
    const dw = (t.width / 100) * canvas.width
    const dh = (t.height / 100) * canvas.height
    const alpha = Math.max(0, Math.min(1, (source.opacity ?? 100) / 100))

    ctx.save()
    ctx.globalAlpha = alpha

    if (source.type === 'chat') {
      drawChatBox(ctx, dx, dy, dw, dh, chatMessages, source)
    } else if (source.type === 'alert') {
      drawAlertBox(ctx, dx, dy, dw, dh, activeAlerts, source, frameTime)
    } else if (source.type === 'followerGoal') {
      drawFollowerGoalWidget(ctx, dx, dy, dw, dh, source, widgetLiveData)
    } else if (source.type === 'subGoal') {
      drawSubGoalWidget(ctx, dx, dy, dw, dh, source, widgetLiveData)
    } else if (source.type === 'viewerCount') {
      drawViewerCountWidget(ctx, dx, dy, dw, dh, source, widgetLiveData)
    } else if (source.type === 'poll') {
      drawPollWidget(ctx, dx, dy, dw, dh, source)
    } else {
      const entry = streams.get(source.id)

      if (entry?.video && entry.video.readyState >= 2) {
        drawMedia(ctx, entry.video, dx, dy, dw, dh, source)
      } else if (entry?.image?.complete && entry.image.naturalWidth > 0) {
        drawMedia(ctx, entry.image, dx, dy, dw, dh, source)
      } else if (source.type === 'text' && source.textContent) {
        drawTextBox(ctx, dx, dy, dw, dh, source.textContent)
      } else if (VIDEO_PLACEHOLDER_TYPES.has(source.type)) {
        drawPlaceholder(ctx, dx, dy, dw, dh, source.name, source.captureName)
      }
    }

    ctx.restore()

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
