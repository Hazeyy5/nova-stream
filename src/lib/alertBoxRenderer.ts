import type { AlertAnimation, AlertBoxStyle, Source, StreamAlert } from '../types'
import {
  alertElapsedMs,
  computeAlertAnimation,
  type AlertAnimState
} from './alertAnimation'
import { getAlertGifMedia } from './alertGifCache'

export { ALERT_ANIMATIONS } from './alertAnimation'

export const ALERT_BOX_STYLES: { id: AlertBoxStyle; label: string }[] = [
  { id: 'classic', label: 'Classique' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'neon', label: 'Néon' },
  { id: 'banner', label: 'Bannière' },
  { id: 'celebration', label: 'Célébration' },
  { id: 'sleek', label: 'Épuré' }
]

const ALERT_META: Record<
  StreamAlert['type'],
  { icon: string; label: string; color: string; accent: string }
> = {
  follow: { icon: '💜', label: 'Nouveau follower', color: '#9146FF', accent: '#c4b5fd' },
  sub: { icon: '⭐', label: 'Nouvel abonné', color: '#f1c40f', accent: '#fde68a' },
  donation: { icon: '💰', label: 'Don', color: '#2ecc71', accent: '#86efac' },
  raid: { icon: '🚀', label: 'Raid', color: '#e74c3c', accent: '#fca5a5' },
  bits: { icon: '💎', label: 'Bits / Cheers', color: '#9b59b6', accent: '#d8b4fe' }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function metaFor(alert: StreamAlert) {
  const base = ALERT_META[alert.type] ?? ALERT_META.follow
  if (alert.title?.trim()) {
    return { ...base, label: alert.title.trim() }
  }
  return base
}

function drawClassic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alert: StreamAlert
): void {
  const meta = metaFor(alert)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = meta.color
  ctx.font = `bold ${Math.max(12, h * 0.22)}px Segoe UI, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(alert.username, x + w / 2, y + h * 0.38)
  ctx.font = `${Math.max(10, h * 0.14)}px Segoe UI, sans-serif`
  ctx.fillStyle = '#fff'
  ctx.fillText(alert.message ?? meta.label, x + w / 2, y + h * 0.62)
}

function drawMinimal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alert: StreamAlert
): void {
  const meta = metaFor(alert)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.95)'
  ctx.shadowBlur = 6
  ctx.fillStyle = meta.accent
  ctx.font = `800 ${Math.max(14, h * 0.24)}px Segoe UI, sans-serif`
  ctx.fillText(alert.username, x + w / 2, y + h * 0.42)
  ctx.font = `600 ${Math.max(10, h * 0.13)}px Segoe UI, sans-serif`
  ctx.fillStyle = '#fff'
  ctx.fillText(alert.message ?? meta.label, x + w / 2, y + h * 0.62)
  ctx.shadowBlur = 0
}

function drawNeon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alert: StreamAlert,
  anim: AlertAnimState
): void {
  const meta = metaFor(alert)
  ctx.save()
  roundRect(ctx, x, y, w, h, 10)
  ctx.fillStyle = 'rgba(8, 6, 20, 0.88)'
  ctx.fill()
  ctx.strokeStyle = meta.color
  ctx.lineWidth = 2
  ctx.shadowColor = meta.color
  ctx.shadowBlur = 16 * anim.glowBoost
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.font = `${Math.max(18, h * 0.32)}px Segoe UI, sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(meta.icon, x + w / 2, y + h * 0.28)

  ctx.fillStyle = meta.color
  ctx.font = `bold ${Math.max(11, h * 0.16)}px Segoe UI, sans-serif`
  ctx.fillText(meta.label.toUpperCase(), x + w / 2, y + h * 0.52)
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${Math.max(12, h * 0.2)}px Segoe UI, sans-serif`
  ctx.fillText(alert.username, x + w / 2, y + h * 0.72)
  ctx.restore()
}

function drawBanner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alert: StreamAlert
): void {
  const meta = metaFor(alert)
  const pad = Math.max(6, w * 0.03)

  ctx.save()
  roundRect(ctx, x, y, w, h, 6)
  const grad = ctx.createLinearGradient(x, y, x + w, y)
  grad.addColorStop(0, 'rgba(0,0,0,0.85)')
  grad.addColorStop(0.08, meta.color)
  grad.addColorStop(0.12, 'rgba(0,0,0,0.82)')
  grad.addColorStop(1, 'rgba(0,0,0,0.82)')
  ctx.fillStyle = grad
  ctx.fill()

  ctx.font = `${Math.max(16, h * 0.55)}px Segoe UI, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(meta.icon, x + pad, y + h / 2)

  const textX = x + pad + Math.max(22, h * 0.65)
  ctx.fillStyle = meta.accent
  ctx.font = `bold ${Math.max(9, h * 0.22)}px Segoe UI, sans-serif`
  ctx.fillText(meta.label, textX, y + h * 0.38)
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${Math.max(11, h * 0.32)}px Segoe UI, sans-serif`
  ctx.fillText(alert.username, textX, y + h * 0.68)
  ctx.restore()
}

function drawCelebration(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alert: StreamAlert
): void {
  const meta = metaFor(alert)
  ctx.save()
  roundRect(ctx, x, y, w, h, 12)
  const bg = ctx.createLinearGradient(x, y, x + w, y + h)
  bg.addColorStop(0, '#1e1035')
  bg.addColorStop(0.5, '#2d1b69')
  bg.addColorStop(1, '#1a0f2e')
  ctx.fillStyle = bg
  ctx.fill()
  ctx.strokeStyle = meta.color
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.font = `${Math.max(22, h * 0.38)}px Segoe UI, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(meta.icon, x + w / 2, y + h * 0.3)

  ctx.fillStyle = '#fff'
  ctx.font = `800 ${Math.max(13, h * 0.22)}px Segoe UI, sans-serif`
  ctx.fillText(alert.username, x + w / 2, y + h * 0.58)
  ctx.fillStyle = meta.accent
  ctx.font = `600 ${Math.max(9, h * 0.13)}px Segoe UI, sans-serif`
  const sub = alert.amount ? `${meta.label} · ${alert.amount}` : (alert.message ?? meta.label)
  ctx.fillText(sub, x + w / 2, y + h * 0.76)
  ctx.restore()
}

function drawSleek(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alert: StreamAlert
): void {
  const meta = metaFor(alert)
  const stripe = Math.max(4, w * 0.018)

  ctx.save()
  roundRect(ctx, x, y, w, h, 8)
  ctx.fillStyle = 'rgba(18, 18, 28, 0.92)'
  ctx.fill()
  ctx.fillStyle = meta.color
  roundRect(ctx, x, y, stripe, h, 8)
  ctx.fill()
  ctx.fillRect(x + stripe - 2, y, 2, h)

  const cx = x + stripe + Math.max(10, w * 0.04)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#94a3b8'
  ctx.font = `600 ${Math.max(8, h * 0.18)}px Segoe UI, sans-serif`
  ctx.fillText(meta.label.toUpperCase(), cx, y + h * 0.32)
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${Math.max(12, h * 0.28)}px Segoe UI, sans-serif`
  ctx.fillText(alert.username, cx, y + h * 0.58)
  if (alert.message || alert.amount) {
    ctx.fillStyle = meta.accent
    ctx.font = `${Math.max(9, h * 0.16)}px Segoe UI, sans-serif`
    ctx.fillText(alert.message ?? alert.amount ?? '', cx, y + h * 0.78)
  }
  ctx.restore()
}

const RENDERERS: Record<
  AlertBoxStyle,
  (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alert: StreamAlert, anim: AlertAnimState) => void
> = {
  classic: (ctx, x, y, w, h, alert) => drawClassic(ctx, x, y, w, h, alert),
  minimal: (ctx, x, y, w, h, alert) => drawMinimal(ctx, x, y, w, h, alert),
  neon: (ctx, x, y, w, h, alert, anim) => drawNeon(ctx, x, y, w, h, alert, anim),
  banner: (ctx, x, y, w, h, alert) => drawBanner(ctx, x, y, w, h, alert),
  celebration: (ctx, x, y, w, h, alert) => drawCelebration(ctx, x, y, w, h, alert),
  sleek: (ctx, x, y, w, h, alert) => drawSleek(ctx, x, y, w, h, alert)
}

function drawCelebrationSparkles(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  elapsedMs: number,
  color: string
): void {
  const enterT = Math.min(1, elapsedMs / 600)
  if (enterT >= 1) return

  const count = 10
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + elapsedMs / 400
    const dist = (0.15 + enterT * 0.55) * Math.min(w, h)
    const px = x + w / 2 + Math.cos(angle) * dist
    const py = y + h / 2 + Math.sin(angle) * dist * 0.6
    const size = 3 + (1 - enterT) * 4
    ctx.fillStyle = color
    ctx.globalAlpha = (1 - enterT) * 0.85
    ctx.beginPath()
    ctx.arc(px, py, size, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function applyAnimTransform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  anim: AlertAnimState,
  layerAlpha: number
): void {
  const cx = x + w / 2
  const cy = y + h / 2
  ctx.translate(cx + anim.offsetX * w, cy + anim.offsetY * h)
  ctx.scale(anim.scale, anim.scale)
  ctx.globalAlpha = layerAlpha * anim.opacity
  ctx.translate(-w / 2, -h / 2)
}

export function drawAlertBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  alerts: StreamAlert[],
  source: Source,
  now = Date.now()
): void {
  const alert = alerts[alerts.length - 1]
  if (!alert) return

  const style = source.alertStyle ?? 'classic'
  const animation = source.alertAnimation ?? 'pop'
  const elapsed = alertElapsedMs(alert, now)
  const anim = computeAlertAnimation(animation, elapsed)
  const render = RENDERERS[style] ?? RENDERERS.classic

  const layerAlpha = ctx.globalAlpha
  const gifMedia = alert.type === 'donation' && alert.gifUrl ? getAlertGifMedia(alert.gifUrl) : null
  const gifBand = gifMedia ? Math.min(h * 0.38, w * 0.42) : 0

  if (style === 'celebration') {
    drawCelebrationSparkles(ctx, x, y, w, h, elapsed, metaFor(alert).color)
  }

  ctx.save()
  applyAnimTransform(ctx, x, y, w, h, anim, layerAlpha)

  if (gifMedia && gifBand > 0) {
    const pad = Math.max(4, h * 0.04)
    const gifSize = Math.min(gifBand, w - pad * 2)
    const gx = (w - gifSize) / 2
    ctx.drawImage(gifMedia, gx, pad, gifSize, gifSize)
  }

  const contentTop = gifMedia && gifBand > 0 ? gifBand + Math.max(4, h * 0.04) : 0
  const contentH = Math.max(h * 0.45, h - contentTop)
  ctx.save()
  ctx.translate(0, contentTop)
  render(ctx, 0, 0, w, contentH, alert, anim)
  ctx.restore()

  ctx.restore()
}
