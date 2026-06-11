import type { ChatBoxStyle, ChatMessage, Source } from '../types'

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

function drawClassic(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  messages: ChatMessage[]
): void {
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#c4b5fd'
  ctx.font = `bold ${Math.max(10, h * 0.07)}px Segoe UI, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('CHAT', x + 8, y + h * 0.1)

  const lineH = Math.max(12, h * 0.12)
  ctx.font = `${Math.max(10, h * 0.065)}px Segoe UI, sans-serif`
  messages.forEach((msg, i) => {
    ctx.fillStyle = msg.color ?? '#ddd'
    const text = `${msg.username}: ${msg.message}`.slice(0, 52)
    ctx.fillText(text, x + 8, y + h * 0.22 + i * lineH)
  })
}

function drawMinimal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  messages: ChatMessage[]
): void {
  const lineH = Math.max(13, h * 0.13)
  const fontSize = Math.max(11, h * 0.07)
  ctx.font = `600 ${fontSize}px Segoe UI, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  messages.forEach((msg, i) => {
    const ty = y + 14 + i * lineH
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 4
    ctx.fillStyle = msg.color ?? '#e9d5ff'
    const user = `${msg.username}: `
    ctx.fillText(user, x + 4, ty)
    const userW = ctx.measureText(user).width
    ctx.fillStyle = '#f5f5f5'
    ctx.fillText(msg.message.slice(0, 40), x + 4 + userW, ty)
    ctx.shadowBlur = 0
  })
}

function drawNeon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  messages: ChatMessage[]
): void {
  ctx.save()
  roundRect(ctx, x, y, w, h, 8)
  ctx.fillStyle = 'rgba(10, 8, 24, 0.82)'
  ctx.fill()
  ctx.strokeStyle = '#a78bfa'
  ctx.lineWidth = 2
  ctx.shadowColor = '#7c3aed'
  ctx.shadowBlur = 12
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.fillStyle = '#22d3ee'
  ctx.font = `bold ${Math.max(10, h * 0.075)}px Segoe UI, sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText('◆ LIVE CHAT', x + 10, y + h * 0.11)

  const lineH = Math.max(12, h * 0.12)
  ctx.font = `${Math.max(10, h * 0.065)}px Segoe UI, sans-serif`
  messages.forEach((msg, i) => {
    ctx.fillStyle = msg.color ?? '#c4b5fd'
    ctx.fillText(`${msg.username}`, x + 10, y + h * 0.22 + i * lineH)
    ctx.fillStyle = '#fff'
    ctx.fillText(msg.message.slice(0, 36), x + 10 + ctx.measureText(`${msg.username} `).width, y + h * 0.22 + i * lineH)
  })
  ctx.restore()
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  messages: ChatMessage[]
): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  roundRect(ctx, x, y, w, h, 10)
  ctx.fill()

  const pad = 6
  const lineH = Math.max(22, h * 0.16)
  let cy = y + pad + 12
  const fontSize = Math.max(9, h * 0.06)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  messages.forEach((msg) => {
    const text = `${msg.username}: ${msg.message}`.slice(0, 44)
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
  messages: ChatMessage[]
): void {
  ctx.fillStyle = '#0a0f0a'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#33ff66'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)

  ctx.fillStyle = '#33ff66'
  ctx.font = `bold ${Math.max(9, h * 0.065)}px Consolas, monospace`
  ctx.textAlign = 'left'
  ctx.fillText('> CHAT_LOG', x + 6, y + h * 0.1)

  const lineH = Math.max(11, h * 0.11)
  ctx.font = `${Math.max(9, h * 0.06)}px Consolas, monospace`
  messages.forEach((msg, i) => {
    ctx.fillStyle = '#33ff66'
    ctx.fillText(`[${msg.username}]`, x + 6, y + h * 0.2 + i * lineH)
    ctx.fillStyle = '#b8ffc9'
    const uw = ctx.measureText(`[${msg.username}] `).width
    ctx.fillText(msg.message.slice(0, 38), x + 6 + uw, y + h * 0.2 + i * lineH)
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
  const style = source.chatStyle ?? 'classic'
  const max = Math.max(1, Math.min(12, source.chatMaxMessages ?? 6))
  const recent = messages.slice(-max)
  const render = RENDERERS[style] ?? drawClassic
  render(ctx, x, y, w, h, recent)
}
