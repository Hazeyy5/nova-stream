import { useEffect, useRef, useState, useCallback } from 'react'
import type { Source, ChatMessage, StreamAlert } from '../types'
import type { StreamEntry } from '../lib/drawScene'
import { usePreviewLoop } from '../hooks/usePreviewLoop'
import './Preview.css'

interface PreviewProps {
  sources: Source[]
  selectedSourceId: string | null
  onSelectSource: (id: string) => void
  onUpdateSource: (id: string, partial: Partial<Source>) => void
  chatMessages: ChatMessage[]
  activeAlerts: StreamAlert[]
  streamsRef: React.RefObject<Map<string, StreamEntry>>
  targetFps?: number
  onFps?: (fps: number) => void
}

export default function Preview({
  sources,
  selectedSourceId,
  onSelectSource,
  onUpdateSource,
  chatMessages,
  activeAlerts,
  streamsRef,
  targetFps = 30,
  onFps
}: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 1280, h: 720 })
  const dragRef = useRef<{ sourceId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  const { updatePreviewState } = usePreviewLoop(canvasRef, streamsRef, targetFps, onFps)

  useEffect(() => {
    updatePreviewState({ sources, selectedSourceId, chatMessages, activeAlerts })
  }, [sources, selectedSourceId, chatMessages, activeAlerts, updatePreviewState])

  const visibleSources = sources
    .filter((s) => s.visible && s.type !== 'chat' && s.type !== 'alert')
    .sort((a, b) => a.transform.zIndex - b.transform.zIndex)

  const widgetSources = sources
    .filter((s) => s.visible && (s.type === 'chat' || s.type === 'alert'))
    .sort((a, b) => a.transform.zIndex - b.transform.zIndex)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const ratio = 16 / 9
      let w = width
      let h = width / ratio
      if (h > height) { h = height; w = height * ratio }
      setCanvasSize({ w: Math.floor(w), h: Math.floor(h) })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * 100
    const my = ((e.clientY - rect.top) / rect.height) * 100

    const hit = [...visibleSources, ...widgetSources].reverse().find((s) => {
      const t = s.transform
      return mx >= t.x && mx <= t.x + t.width && my >= t.y && my <= t.y + t.height
    })

    if (hit) {
      onSelectSource(hit.id)
      if (hit.locked || hit.type === 'chat' || hit.type === 'alert') return
      dragRef.current = { sourceId: hit.id, startX: mx, startY: my, origX: hit.transform.x, origY: hit.transform.y }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * 100
    const my = ((e.clientY - rect.top) / rect.height) * 100
    const dx = mx - dragRef.current.startX
    const dy = my - dragRef.current.startY
    const source = sources.find((s) => s.id === dragRef.current!.sourceId)
    if (!source) return

    onUpdateSource(dragRef.current.sourceId, {
      transform: {
        ...source.transform,
        x: Math.max(0, Math.min(100 - source.transform.width, dragRef.current.origX + dx)),
        y: Math.max(0, Math.min(100 - source.transform.height, dragRef.current.origY + dy))
      }
    })
  }

  const handleMouseUp = useCallback(() => { dragRef.current = null }, [])

  return (
    <div className="preview-area">
      <div className="preview-toolbar">
        <span className="preview-label">Aperçu</span>
        <span className="preview-res">{canvasSize.w} × {canvasSize.h}</span>
      </div>
      <div className="preview-viewport" ref={containerRef}>
        <div className="preview-stage">
          <canvas
            ref={canvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            className="preview-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </div>
    </div>
  )
}
