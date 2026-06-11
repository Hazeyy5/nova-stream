import type { ChromaKeySettings } from '../types'

const MAX_CHROMA_DIM = 720

let scratchCanvas: HTMLCanvasElement | null = null
let scratchCtx: CanvasRenderingContext2D | null = null

function getScratch(w: number, h: number): CanvasRenderingContext2D {
  if (!scratchCanvas || scratchCanvas.width < w || scratchCanvas.height < h) {
    scratchCanvas = document.createElement('canvas')
    scratchCanvas.width = Math.max(w, 1)
    scratchCanvas.height = Math.max(h, 1)
    scratchCtx = scratchCanvas.getContext('2d', { willReadFrequently: true })
  }
  if (!scratchCtx) throw new Error('Canvas 2D indisponible')
  return scratchCtx
}

function parseHexColor(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function applyChromaKeyToImageData(
  data: ImageData,
  settings: ChromaKeySettings
): void {
  const [tr, tg, tb] = parseHexColor(settings.color)
  const similarity = Math.max(0.05, settings.similarity) * 441.67
  const similaritySq = similarity * similarity
  const smoothness = Math.max(0.01, settings.smoothness) * 441.67
  const outerSq = (similarity + smoothness) * (similarity + smoothness)
  const px = data.data

  for (let i = 0; i < px.length; i += 4) {
    const dr = px[i] - tr
    const dg = px[i + 1] - tg
    const db = px[i + 2] - tb
    const distSq = dr * dr + dg * dg + db * db

    if (distSq < similaritySq) {
      px[i + 3] = 0
    } else if (distSq < outerSq) {
      const dist = Math.sqrt(distSq)
      px[i + 3] = Math.round(px[i + 3] * ((dist - similarity) / smoothness))
    }
  }
}

export function drawWithChromaKey(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  settings: ChromaKeySettings
): void {
  let iw = Math.max(1, Math.round(dw))
  let ih = Math.max(1, Math.round(dh))

  if (Math.max(iw, ih) > MAX_CHROMA_DIM) {
    const scale = MAX_CHROMA_DIM / Math.max(iw, ih)
    iw = Math.max(1, Math.round(iw * scale))
    ih = Math.max(1, Math.round(ih * scale))
  }

  const sctx = getScratch(iw, ih)
  sctx.clearRect(0, 0, iw, ih)
  sctx.drawImage(media, sx, sy, sw, sh, 0, 0, iw, ih)

  const imageData = sctx.getImageData(0, 0, iw, ih)
  applyChromaKeyToImageData(imageData, settings)
  sctx.putImageData(imageData, 0, 0)
  ctx.drawImage(scratchCanvas!, 0, 0, iw, ih, dx, dy, dw, dh)
}
