import { useEffect, useRef, useState, useCallback } from 'react'
import type { Source, ChatMessage, StreamAlert } from '../types'
import ChatOverlay from './widgets/ChatOverlay'
import AlertOverlay from './widgets/AlertOverlay'
import './Preview.css'

interface PreviewProps {
  sources: Source[]
  selectedSourceId: string | null
  onSelectSource: (id: string) => void
  onUpdateSource: (id: string, partial: Partial<Source>) => void
  chatMessages: ChatMessage[]
  activeAlerts: StreamAlert[]
}

interface StreamEntry {
  sourceId: string
  stream: MediaStream | null
  video: HTMLVideoElement | null
  image: HTMLImageElement | null
}

export default function Preview({
  sources,
  selectedSourceId,
  onSelectSource,
  onUpdateSource,
  chatMessages,
  activeAlerts
}: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const streamsRef = useRef<Map<string, StreamEntry>>(new Map())
  const animRef = useRef<number>(0)
  const [canvasSize, setCanvasSize] = useState({ w: 1280, h: 720 })
  const dragRef = useRef<{ sourceId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)

  const visibleSources = sources
    .filter((s) => s.visible && s.type !== 'chat' && s.type !== 'alert')
    .sort((a, b) => a.transform.zIndex - b.transform.zIndex)

  const widgetSources = sources
    .filter((s) => s.visible && (s.type === 'chat' || s.type === 'alert'))
    .sort((a, b) => a.transform.zIndex - b.transform.zIndex)

  const acquireStream = useCallback(async (source: Source): Promise<StreamEntry> => {
    const entry: StreamEntry = { sourceId: source.id, stream: null, video: null, image: null }

    if (source.type === 'display') {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
        const video = document.createElement('video')
        video.srcObject = stream
        video.muted = true
        await video.play()
        entry.stream = stream
        entry.video = video
      } catch { /* user cancelled */ }
    } else if (source.type === 'webcam') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        const video = document.createElement('video')
        video.srcObject = stream
        video.muted = true
        await video.play()
        entry.stream = stream
        entry.video = video
      } catch { /* no camera */ }
    } else if (source.type === 'image' && source.imageUrl) {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.src = source.imageUrl
      await new Promise((res) => { image.onload = res; image.onerror = res })
      entry.image = image
    }

    return entry
  }, [])

  useEffect(() => {
    const visibleIds = new Set(visibleSources.map((s) => s.id))
    const map = streamsRef.current

    for (const [id, entry] of map) {
      if (!visibleIds.has(id)) {
        entry.stream?.getTracks().forEach((t) => t.stop())
        map.delete(id)
      }
    }

    for (const source of visibleSources) {
      if (!map.has(source.id) && (source.type === 'display' || source.type === 'webcam' || (source.type === 'image' && source.imageUrl))) {
        acquireStream(source).then((entry) => {
          if (visibleSources.some((s) => s.id === source.id)) {
            map.set(source.id, entry)
          } else {
            entry.stream?.getTracks().forEach((t) => t.stop())
          }
        })
      }
    }
  }, [visibleSources, acquireStream])

  useEffect(() => {
    return () => {
      streamsRef.current.forEach((entry) => {
        entry.stream?.getTracks().forEach((t) => t.stop())
      })
      streamsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#0a0a10'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      for (const source of visibleSources) {
        const entry = streamsRef.current.get(source.id)
        const t = source.transform
        const dx = (t.x / 100) * canvas.width
        const dy = (t.y / 100) * canvas.height
        const dw = (t.width / 100) * canvas.width
        const dh = (t.height / 100) * canvas.height

        if (entry?.video && entry.video.readyState >= 2) {
          ctx.drawImage(entry.video, dx, dy, dw, dh)
        } else if (entry?.image) {
          ctx.drawImage(entry.image, dx, dy, dw, dh)
        } else if (source.type === 'text' && source.textContent) {
          ctx.fillStyle = 'rgba(0,0,0,0.55)'
          ctx.fillRect(dx, dy, dw, dh)
          ctx.fillStyle = '#fff'
          ctx.font = `bold ${Math.max(14, dh * 0.5)}px Segoe UI, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(source.textContent, dx + dw / 2, dy + dh / 2)
        } else if (source.type === 'display' || source.type === 'webcam') {
          ctx.fillStyle = '#1a1a28'
          ctx.fillRect(dx, dy, dw, dh)
          ctx.strokeStyle = '#333'
          ctx.strokeRect(dx, dy, dw, dh)
          ctx.fillStyle = '#666'
          ctx.font = '13px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(source.name, dx + dw / 2, dy + dh / 2)
        }

        if (source.id === selectedSourceId) {
          ctx.strokeStyle = '#7c3aed'
          ctx.lineWidth = 2
          ctx.setLineDash([6, 4])
          ctx.strokeRect(dx, dy, dw, dh)
          ctx.setLineDash([])
        }
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [visibleSources, selectedSourceId])

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

    const hit = [...visibleSources].reverse().find((s) => {
      const t = s.transform
      return mx >= t.x && mx <= t.x + t.width && my >= t.y && my <= t.y + t.height
    })

    if (hit) {
      onSelectSource(hit.id)
      if (hit.locked) return
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

  const handleMouseUp = () => { dragRef.current = null }

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
          {widgetSources.map((src) => {
            const t = src.transform
            return (
              <div
                key={src.id}
                className={`widget-layer ${src.id === selectedSourceId ? 'selected' : ''}`}
                style={{
                  left: `${t.x}%`,
                  top: `${t.y}%`,
                  width: `${t.width}%`,
                  height: `${t.height}%`,
                  zIndex: t.zIndex
                }}
                onMouseDown={(e) => {
                  e.stopPropagation()
                  onSelectSource(src.id)
                }}
              >
                {src.type === 'chat' && <ChatOverlay messages={chatMessages} />}
                {src.type === 'alert' && <AlertOverlay alerts={activeAlerts} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
