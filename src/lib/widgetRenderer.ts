import type { GoalWidgetStyle, PollWidgetStyle, Source, WidgetLiveData } from '../types'

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

function usesLiveWidgetData(source: Source): boolean {
  return source.widgetUseLiveData !== false
}

function resolveCurrent(source: Source, live: WidgetLiveData, kind: 'followers' | 'subs' | 'viewers'): number {
  if (usesLiveWidgetData(source)) {
    if (kind === 'followers') return live.followerCount
    if (kind === 'subs') return live.subCount
    if (kind === 'viewers') return live.viewerCount
  }
  return Math.max(0, source.widgetGoalCurrent ?? 0)
}

function drawGoalBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  current: number,
  target: number,
  style: GoalWidgetStyle,
  accent: string
): void {
  const safeTarget = Math.max(1, target)
  const progress = Math.min(1, current / safeTarget)
  const pad = Math.max(6, w * 0.04)

  if (style === 'minimal') {
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.max(12, h * 0.28)}px Segoe UI, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.9)'
    ctx.shadowBlur = 5
    ctx.fillText(`${label}: ${current} / ${safeTarget}`, x + w / 2, y + h / 2)
    ctx.shadowBlur = 0
    return
  }

  ctx.save()
  if (style === 'neon') {
    roundRect(ctx, x, y, w, h, 10)
    ctx.fillStyle = 'rgba(8, 6, 22, 0.9)'
    ctx.fill()
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.shadowColor = accent
    ctx.shadowBlur = 14
    ctx.stroke()
    ctx.shadowBlur = 0
  } else {
    roundRect(ctx, x, y, w, h, 8)
    ctx.fillStyle = style === 'bar' ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.62)'
    ctx.fill()
  }

  ctx.fillStyle = '#c4b5fd'
  ctx.font = `bold ${Math.max(9, h * 0.16)}px Segoe UI, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(label.toUpperCase(), x + pad, y + h * 0.28)

  const barY = y + h * 0.38
  const barH = Math.max(8, h * 0.22)
  const barW = w - pad * 2
  roundRect(ctx, x + pad, barY, barW, barH, barH / 2)
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fill()
  if (progress > 0) {
    roundRect(ctx, x + pad, barY, Math.max(barH, barW * progress), barH, barH / 2)
    ctx.fillStyle = accent
    ctx.fill()
  }

  ctx.fillStyle = '#fff'
  ctx.font = `bold ${Math.max(11, h * 0.22)}px Segoe UI, sans-serif`
  ctx.textAlign = 'right'
  ctx.fillText(`${current} / ${safeTarget}`, x + w - pad, y + h * 0.82)
  ctx.restore()
}

export function drawFollowerGoalWidget(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  source: Source,
  live: WidgetLiveData
): void {
  const current = resolveCurrent(source, live, 'followers')
  const target = Math.max(1, source.widgetGoalTarget ?? 100)
  const label = source.widgetLabel ?? 'Objectif followers'
  const style = source.goalStyle ?? 'classic'
  drawGoalBar(ctx, x, y, w, h, label, current, target, style, '#9146FF')
}

export function drawSubGoalWidget(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  source: Source,
  live: WidgetLiveData
): void {
  const current = resolveCurrent(source, live, 'subs')
  const target = Math.max(1, source.widgetGoalTarget ?? 50)
  const label = source.widgetLabel ?? 'Objectif abonnés'
  const style = source.goalStyle ?? 'classic'
  drawGoalBar(ctx, x, y, w, h, label, current, target, style, '#f1c40f')
}

export function drawViewerCountWidget(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  source: Source,
  live: WidgetLiveData
): void {
  const count = resolveCurrent(source, live, 'viewers')
  const label = source.widgetLabel ?? 'Spectateurs'
  const style = source.goalStyle ?? 'neon'

  ctx.save()
  if (style === 'minimal') {
    ctx.fillStyle = '#fff'
    ctx.font = `800 ${Math.max(16, h * 0.45)}px Segoe UI, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.95)'
    ctx.shadowBlur = 6
    ctx.fillText(String(count), x + w / 2, y + h * 0.55)
    ctx.font = `600 ${Math.max(9, h * 0.16)}px Segoe UI, sans-serif`
    ctx.fillStyle = '#c4b5fd'
    ctx.fillText(label.toUpperCase(), x + w / 2, y + h * 0.22)
    ctx.shadowBlur = 0
    ctx.restore()
    return
  }

  roundRect(ctx, x, y, w, h, 10)
  ctx.fillStyle = 'rgba(10, 8, 24, 0.88)'
  ctx.fill()
  ctx.strokeStyle = '#22d3ee'
  ctx.lineWidth = 2
  ctx.shadowColor = '#22d3ee'
  ctx.shadowBlur = style === 'neon' ? 16 : 0
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.fillStyle = '#22d3ee'
  ctx.font = `bold ${Math.max(9, h * 0.14)}px Segoe UI, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('👁 ' + label.toUpperCase(), x + w / 2, y + h * 0.28)
  ctx.fillStyle = '#fff'
  ctx.font = `800 ${Math.max(18, h * 0.42)}px Segoe UI, sans-serif`
  ctx.fillText(String(count), x + w / 2, y + h * 0.62)
  ctx.restore()
}

export function drawPollWidget(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  source: Source
): void {
  const question = source.pollQuestion ?? 'Quel est votre jeu préféré ?'
  const options = source.pollOptions?.length ? source.pollOptions : ['Option A', 'Option B', 'Option C']
  const votes = source.pollVotes?.length === options.length
    ? source.pollVotes
    : options.map(() => 0)
  const total = votes.reduce((a, b) => a + b, 0) || 1
  const style = source.pollStyle ?? 'classic'
  const pad = Math.max(6, w * 0.04)

  ctx.save()
  roundRect(ctx, x, y, w, h, 8)
  ctx.fillStyle = 'rgba(0,0,0,0.72)'
  ctx.fill()
  if (style === 'bars') {
    ctx.strokeStyle = '#a78bfa'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  ctx.fillStyle = '#c4b5fd'
  ctx.font = `bold ${Math.max(9, h * 0.12)}px Segoe UI, sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText('📊 SONDAGE', x + pad, y + h * 0.12)
  ctx.fillStyle = '#fff'
  ctx.font = `600 ${Math.max(9, h * 0.11)}px Segoe UI, sans-serif`
  const q = question.length > 42 ? question.slice(0, 41) + '…' : question
  ctx.fillText(q, x + pad, y + h * 0.22)

  const rowH = (h * 0.68) / options.length
  const startY = y + h * 0.28
  options.forEach((opt, i) => {
    const pct = votes[i] / total
    const rowY = startY + i * rowH
    const barMaxW = w - pad * 2
    const label = opt.length > 28 ? opt.slice(0, 27) + '…' : opt

    if (style === 'bars') {
      roundRect(ctx, x + pad, rowY + rowH * 0.15, barMaxW, rowH * 0.55, 4)
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fill()
      if (pct > 0) {
        roundRect(ctx, x + pad, rowY + rowH * 0.15, Math.max(4, barMaxW * pct), rowH * 0.55, 4)
        ctx.fillStyle = `rgba(124, 58, 237, ${0.45 + pct * 0.45})`
        ctx.fill()
      }
    }

    ctx.fillStyle = '#ddd'
    ctx.font = `${Math.max(8, h * 0.09)}px Segoe UI, sans-serif`
    ctx.fillText(`${label} (${Math.round(pct * 100)}%)`, x + pad + 4, rowY + rowH * 0.55)
  })
  ctx.restore()
}

export const GOAL_WIDGET_STYLES: { id: GoalWidgetStyle; label: string }[] = [
  { id: 'classic', label: 'Classique' },
  { id: 'bar', label: 'Barre' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'neon', label: 'Néon' }
]

export const POLL_WIDGET_STYLES: { id: PollWidgetStyle; label: string }[] = [
  { id: 'classic', label: 'Classique' },
  { id: 'bars', label: 'Barres' }
]
