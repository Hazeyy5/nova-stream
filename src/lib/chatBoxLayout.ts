import type { ChatBoxStyle } from '../types'

export interface ChatBoxLayout {
  headerH: number
  pad: number
  lineH: number
  fontSize: number
  titleSize: number
  maxVisible: number
}

export function resolveChatBoxLayout(
  w: number,
  h: number,
  style: ChatBoxStyle,
  maxMessages: number
): ChatBoxLayout {
  const pad = Math.max(6, Math.min(w, h) * 0.04)
  const titleSize = Math.max(9, Math.min(w, h) * 0.075)
  const headerH = style === 'minimal' ? pad + 4 : titleSize + pad * 1.6
  const innerH = Math.max(1, h - headerH - pad)
  const lineH = Math.max(
    12,
    style === 'bubble' ? innerH / Math.max(2, maxMessages) * 0.9 : innerH / Math.max(3, maxMessages)
  )
  const fontSize = Math.max(9, Math.min(lineH * 0.82, w * 0.045))
  const maxVisible = Math.max(
    1,
    Math.min(
      maxMessages,
      Math.floor(innerH / lineH)
    )
  )

  return { headerH, pad, lineH, fontSize, titleSize, maxVisible }
}
