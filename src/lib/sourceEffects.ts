import type { Source } from '../types'

export type MediaSourceType = 'display' | 'screen' | 'window' | 'game' | 'browser' | 'webcam' | 'image'

export const MEDIA_SOURCE_TYPES = new Set<Source['type']>([
  'display', 'screen', 'window', 'game', 'browser', 'webcam', 'image'
])

export function isMediaSource(type: Source['type']): type is MediaSourceType {
  return MEDIA_SOURCE_TYPES.has(type)
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Applique un masque (coins arrondis, cercle). Retourne true si un clip a été posé. */
export function applySourceMaskClip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  source: Source
): boolean {
  const shape = source.maskShape ?? 'none'
  if (shape === 'none' || w <= 0 || h <= 0) return false

  const radiusPct = Math.max(0, Math.min(50, source.maskRadius ?? 16))
  const radius = (radiusPct / 100) * Math.min(w, h)

  if (shape === 'circle') {
    ctx.beginPath()
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    ctx.clip()
    return true
  }

  roundRectPath(ctx, x, y, w, h, radius)
  ctx.clip()
  return true
}

/** Filtres CSS canvas (luminosité, contraste, etc.). */
export function buildSourceCanvasFilter(source: Source): string {
  const parts: string[] = []
  const brightness = source.brightness ?? 100
  const contrast = source.contrast ?? 100
  const saturation = source.saturation ?? 100
  const blur = source.blur ?? 0

  if (brightness !== 100) parts.push(`brightness(${brightness / 100})`)
  if (contrast !== 100) parts.push(`contrast(${contrast / 100})`)
  if (saturation !== 100) parts.push(`saturate(${saturation / 100})`)
  if (blur > 0) parts.push(`blur(${blur}px)`)

  return parts.length > 0 ? parts.join(' ') : 'none'
}
