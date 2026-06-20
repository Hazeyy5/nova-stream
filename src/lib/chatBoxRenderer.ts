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

/** Découpe le texte sur plusieurs lignes selon la largeur disponible. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text || maxWidth <= 4) return ['']
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines: string[] = []
  let current = ''

  const pushLongToken = (token: string) => {
    let chunk = ''
    for (const ch of token) {
      const next = chunk + ch
      if (ctx.measureText(next).width > maxWidth && chunk) {
        lines.push(chunk)
        chunk = ch
      } else {
        chunk = next
      }
    }
    current = chunk
  }

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    if (ctx.measureText(word).width > maxWidth) {
      pushLongToken(word)
    } else {
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  x: number,
  cy: number,
  bottomY: number,
  lineH: number,
  lines: string[],
  color: string
): number {
  ctx.fillStyle = color
  for (const line of lines) {
    if (cy > bottomY) break
    ctx.fillText(line, x, cy)
    cy += lineH
  }
  return cy
}

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
  const maxWidth = w - pad * 2
  const bottomY = y + h - pad

  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#c4b5fd'
  ctx.font = `bold ${titleSize}px Segoe UI, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('CHAT', x + pad, y + pad + titleSize)

  ctx.font = `${fontSize}px Segoe UI, sans-serif`
  let cy = y + pad + titleSize + lineH
  for (const msg of messages) {
    if (cy > bottomY) break
    const lines = wrapText(ctx, `${msg.username}: ${msg.message}`, maxWidth)
    cy = drawLines(ctx, x + pad, cy, bottomY, lineH, lines, msg.color ?? '#ddd')
  }
}

function drawMinimal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  messages: ChatMessage[],
  layout: Layout
): void {
  const { pad, lineH, fontSize } = layout
  const maxWidth = w - pad * 2
  const bottomY = y + h - pad

  ctx.font = `600 ${fontSize}px Segoe UI, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  let cy = y + pad + fontSize
  for (const msg of messages) {
    if (cy > bottomY) break
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 4
    const user = `${msg.username}: `
    const userW = ctx.measureText(user).width
    const msgLines = wrapText(ctx, msg.message, Math.max(24, maxWidth - userW))
    ctx.fillStyle = msg.color ?? '#e9d5ff'
    ctx.fillText(user, x + pad, cy)
    cy = drawLines(ctx, x + pad + userW, cy, bottomY, lineH, msgLines.slice(0, 1), '#f5f5f5')
    if (msgLines.length > 1) {
      cy = drawLines(ctx, x + pad, cy, bottomY, lineH, msgLines.slice(1), '#f5f5f5')
    }
    ctx.shadowBlur = 0
  }
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
  const maxWidth = w - pad * 2
  const bottomY = y + h - pad

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
  let cy = y + pad + titleSize + lineH
  for (const msg of messages) {
    if (cy > bottomY) break
    const user = `${msg.username} `
    const userW = ctx.measureText(user).width
    ctx.fillStyle = msg.color ?? '#c4b5fd'
    ctx.fillText(user, x + pad, cy)
    const msgLines = wrapText(ctx, msg.message, Math.max(24, maxWidth - userW))
    cy = drawLines(ctx, x + pad + userW, cy, bottomY, lineH, msgLines.slice(0, 1), '#fff')
    if (msgLines.length > 1) {
      cy = drawLines(ctx, x + pad, cy, bottomY, lineH, msgLines.slice(1), '#fff')
    }
  }
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
  const maxWidth = w - pad * 2 - 16
  const bottomY = y + h - pad

  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  roundRect(ctx, x, y, w, h, Math.min(10, w * 0.03))
  ctx.fill()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${fontSize}px Segoe UI, sans-serif`

  let cy = y + pad + fontSize
  for (const msg of messages) {
    if (cy > bottomY) break
    const lines = wrapText(ctx, `${msg.username}: ${msg.message}`, maxWidth)
    const bubbleH = Math.max(lineH - 4, lines.length * lineH - 4)
    const tw = Math.min(maxWidth + 16, Math.max(...lines.map((l) => ctx.measureText(l).width), 0) + 16)

    ctx.fillStyle = 'rgba(124, 58, 237, 0.35)'
    roundRect(ctx, x + pad, cy - fontSize - 2, tw, bubbleH, 6)
    ctx.fill()

    cy = drawLines(ctx, x + pad + 8, cy, bottomY, lineH, lines, msg.color ?? '#ddd')
    cy += 4
  }
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
  const maxWidth = w - pad * 2
  const bottomY = y + h - pad

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
  let cy = y + pad + titleSize + lineH
  for (const msg of messages) {
    if (cy > bottomY) break
    const user = `[${msg.username}] `
    const userW = ctx.measureText(user).width
    ctx.fillStyle = '#33ff66'
    ctx.fillText(user, x + pad, cy)
    const msgLines = wrapText(ctx, msg.message, Math.max(24, maxWidth - userW))
    cy = drawLines(ctx, x + pad + userW, cy, bottomY, lineH, msgLines.slice(0, 1), '#b8ffc9')
    if (msgLines.length > 1) {
      cy = drawLines(ctx, x + pad, cy, bottomY, lineH, msgLines.slice(1), '#b8ffc9')
    }
  }
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
