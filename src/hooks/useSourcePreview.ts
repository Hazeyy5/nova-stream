import { useEffect, useRef } from 'react'
import type { Source } from '../types'
import { DEFAULT_WIDGET_LIVE_DATA } from '../types'
import { isCanvasWidget } from '../lib/widgetTypes'
import { acquireSourceStream, drawScene, releaseSourceStream, type StreamEntry } from '../lib/drawScene'

const PREVIEW_W = 320
const PREVIEW_H = 180

const STATIC_PREVIEW_TYPES: Source['type'][] = [
  'text', 'chat', 'alert', 'followerGoal', 'subGoal', 'viewerCount', 'poll'
]

function previewFingerprint(source: Source): string {
  return `${source.type}|${source.captureId ?? ''}|${source.browserUrl ?? ''}|${source.imageUrl ?? ''}|${source.imageLocalPath ?? ''}|${source.textContent ?? ''}|${source.scaleMode ?? ''}|${source.blendMode ?? ''}|${source.chatStyle ?? ''}|${source.chatMaxMessages ?? ''}|${source.alertStyle ?? ''}|${source.goalStyle ?? ''}|${source.pollQuestion ?? ''}|${(source.pollOptions ?? []).join('|')}`
}

function canPreview(source: Source): boolean {
  if (source.type === 'text') return !!source.textContent
  if (isCanvasWidget(source.type)) return true
  if (source.type === 'screen' || source.type === 'window') return !!source.captureId
  if (source.type === 'image') return !!(source.imageUrl || source.imageLocalPath)
  if (source.type === 'browser') return !!source.browserUrl
  return source.type === 'display' || source.type === 'webcam'
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, message: string): void {
  ctx.fillStyle = '#0a0a10'
  ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H)
  ctx.fillStyle = '#555'
  ctx.font = '13px Segoe UI, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(message, PREVIEW_W / 2, PREVIEW_H / 2)
}

export function useSourcePreview(source: Source) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamsRef = useRef<Map<string, StreamEntry>>(new Map())
  const previewable = canPreview(source)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = PREVIEW_W
    canvas.height = PREVIEW_H

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let active = true
    let raf = 0
    const fingerprint = previewFingerprint(source)

    const drawFrame = () => {
      if (!active) return
      const previewSource: Source = {
        ...source,
        visible: true,
        transform: { x: 0, y: 0, width: 100, height: 100, zIndex: 0 }
      }
      drawScene(ctx, canvas, [previewSource], streamsRef.current, {
        chatMessages: source.type === 'chat'
          ? [{ id: '1', platform: 'twitch', username: 'Viewer', message: 'Salut !', timestamp: Date.now() }]
          : [],
        activeAlerts: source.type === 'alert'
          ? [{
              id: '1',
              type: 'follow',
              username: 'NouveauViewer',
              message: 'vient de suivre !',
              shownAt: Math.floor(Date.now() / 5000) * 5000
            }]
          : [],
        frameTime: Date.now(),
        widgetLiveData: {
          ...DEFAULT_WIDGET_LIVE_DATA,
          followerCount: 842,
          viewerCount: 127,
          subCount: 48,
          live: true
        }
      })
      raf = requestAnimationFrame(drawFrame)
    }

    const cleanup = () => {
      for (const [id] of streamsRef.current) {
        const entry = streamsRef.current.get(id)!
        entry.stream?.getTracks().forEach((t) => t.stop())
        releaseSourceStream(id, source.type)
      }
      streamsRef.current.clear()
    }

    if (!previewable) {
      drawPlaceholder(ctx, 'Configurez la source pour voir l\'aperçu')
      return () => { active = false }
    }

    if (STATIC_PREVIEW_TYPES.includes(source.type)) {
      raf = requestAnimationFrame(drawFrame)
      return () => {
        active = false
        cancelAnimationFrame(raf)
      }
    }

    acquireSourceStream(source).then((entry) => {
      if (!active) {
        entry.stream?.getTracks().forEach((t) => t.stop())
        releaseSourceStream(source.id, source.type)
        return
      }
      if (previewFingerprint(source) !== fingerprint) {
        entry.stream?.getTracks().forEach((t) => t.stop())
        releaseSourceStream(source.id, source.type)
        return
      }
      streamsRef.current.set(source.id, entry)
      raf = requestAnimationFrame(drawFrame)
    }).catch(() => {
      if (active) drawPlaceholder(ctx, 'Impossible de charger l\'aperçu')
    })

    return () => {
      active = false
      cancelAnimationFrame(raf)
      cleanup()
    }
  }, [source, previewable])

  return canvasRef
}
