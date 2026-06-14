import type { ChatBoxStyle, ChatMessage, Source } from '../types'
import { resolveChatBoxLayout } from './chatBoxLayout'

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

type Layout = ReturnType<typeof resolveChatBoxLayout>

function drawClassic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  messages: ChatMessage[],
  layout: Layout
): void {
  const { pad, lineH, fontSize, titleSize } = layout

  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#c4b5fd'
  ctx.font = `bold ${titleSize}px Segoe UI, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('CHAT', x + pad, y + pad + titleSize)

  ctx.font = `${fontSize}px Segoe UI, sans-serif`
  messages.forEach((msg, i) => {
    ctx.fillStyle = msg.color ?? '#ddd'
    const text = `${msg.username}: ${msg.message}`.slice(0, Math.max(12, Math.floor(w / 7)))
    ctx.fillText(text, x + pad, y + pad + titleSize + lineH * (i + 1))
  })
}

function drawMinimal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  _h: number,
  messages: ChatMessage[],
  layout: Layout
): void {
  const { pad, lineH, fontSize } = layout

  ctx.font = `600 ${fontSize}px Segoe UI, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  messages.forEach((msg, i) => {
    const ty = y + pad + fontSize + i * lineH
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 4
    ctx.fillStyle = msg.color ?? '#e9d5ff'
    const user = `${msg.username}: `
    ctx.fillText(user, x + pad, ty)
    const userW = ctx.measureText(user).width
    ctx.fillStyle = '#f5f5f5'
    ctx.fillText(
      msg.message.slice(0, Math.max(10, Math.floor((w - pad * 2 - userW) / (fontSize * 0.55)))),
      x + pad + userW,
      ty
    )
    ctx.shadowBlur = 0
  })
}

function drawNeon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  messages: ChatMessage[],
  layout: Layout
): void {
  const { pad, lineH, fontSize, titleSize } = layout

  ctx.save()
  roundRect(ctx, x, y, w, h, Math.min(12, w * 0.04))
  ctx.fillStyle = 'rgba(10, 8, 24, 0.82)'
  ctx.fill()
  ctx.strokeStyle = '#a78bfa'
  ctx.lineWidth = Math.max(1, w * 0.004)
  ctx.shadowColor = '#7c3aed'
  ctx.shadowBlur = 12
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.fillStyle = '#22d3ee'
  ctx.font = `bold ${titleSize}px Segoe UI, sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText('◆ LIVE CHAT', x + pad, y + pad + titleSize)

  ctx.font = `${fontSize}px Segoe UI, sans-serif`
  messages.forEach((msg, i) => {
    const lineY = y + pad + titleSize + lineH * (i + 1)
    ctx.fillStyle = msg.color ?? '#c4b5fd'
    ctx.fillText(`${msg.username}`, x + pad, lineY)
    ctx.fillStyle = '#fff'
    const userW = ctx.measureText(`${msg.username} `).width
    ctx.fillText(
      msg.message.slice(0, Math.max(8, Math.floor((w - pad * 2 - userW) / (fontSize * 0.55)))),
      x + pad + userW,
      lineY
    )
  })
  ctx.restore()
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  messages: ChatMessage[],
  layout: Layout
): void {
  const { pad, lineH, fontSize } = layout

  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  roundRect(ctx, x, y, w, h, Math.min(10, w * 0.03))
  ctx.fill()

  let cy = y + pad + fontSize
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  messages.forEach((msg) => {
    const text = `${msg.username}: ${msg.message}`.slice(0, Math.max(12, Math.floor(w / 8)))
    ctx.font = `${fontSize}px Segoe UI, sans-serif`
    const tw = Math.min(w - pad * 2, ctx.measureText(text).width + 16)
    const bh = lineH - 4

    ctx.fillStyle = 'rgba(124, 58, 237, 0.35)'
    roundRect(ctx, x + pad, cy - fontSize - 2, tw, bh, 6)
    ctx.fill()

    ctx.fillStyle = msg.color ?? '#ddd'
    ctx.fillText(text, x + pad + 8, cy)
    cy += lineH
  })
}

function drawRetro(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  messages: ChatMessage[],
  layout: Layout
): void {
  const { pad, lineH, fontSize, titleSize } = layout

  ctx.fillStyle = '#0a0f0a'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#33ff66'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)

  ctx.fillStyle = '#33ff66'
  ctx.font = `bold ${titleSize}px Consolas, monospace`
  ctx.textAlign = 'left'
  ctx.fillText('> CHAT_LOG', x + pad, y + pad + titleSize)

  ctx.font = `${fontSize}px Consolas, monospace`
  messages.forEach((msg, i) => {
    const lineY = y + pad + titleSize + lineH * (i + 1)
    ctx.fillStyle = '#33ff66'
    ctx.fillText(`[${msg.username}]`, x + pad, lineY)
    ctx.fillStyle = '#b8ffc9'
    const uw = ctx.measureText(`[${msg.username}] `).width
    ctx.fillText(
      msg.message.slice(0, Math.max(8, Math.floor((w - pad * 2 - uw) / (fontSize * 0.6)))),
      x + pad + uw,
      lineY
    )
  })
}

const RENDERERS: Record<ChatBoxStyle, typeof drawClassic> = {
  classic: drawClassic,
  minimal: drawMinimal,
  neon: drawNeon,
  bubble: drawBubble,
  retro: drawRetro
}

export const CHAT_BOX_STYLES: { id: ChatBoxStyle; label: string }[] = [
  { id: 'classic', label: 'Classique' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'neon', label: 'Néon' },
  { id: 'bubble', label: 'Bulles' },
  { id: 'retro', label: 'Rétro' }
]

export function drawChatBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  messages: ChatMessage[],
  source: Source
): void {
  if (w < 2 || h < 2) return

  const style = source.chatStyle ?? 'classic'
  const maxSetting = Math.max(1, Math.min(12, source.chatMaxMessages ?? 6))
  const layout = resolveChatBoxLayout(w, h, style, maxSetting)
  const recent = messages.slice(-layout.maxVisible)

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()

  const render = RENDERERS[style] ?? drawClassic
  render(ctx, x, y, w, h, recent, layout)
  ctx.restore()
}
