import { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import type { Source, ChatMessage, StreamAlert, SourceTransform } from '../types'
import type { StreamEntry } from '../lib/drawScene'
import { usePreviewLoop } from '../hooks/usePreviewLoop'
import './Preview.css'

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

interface PreviewProps {
  sources: Source[]
  selectedSourceId: string | null
  onSelectSource: (id: string) => void
  onUpdateSource: (id: string, partial: Partial<Source>) => void
  chatMessages: ChatMessage[]
  activeAlerts: StreamAlert[]
  streamsRef: React.RefObject<Map<string, StreamEntry>>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  resolution: string
  targetFps?: number
  onFps?: (fps: number) => void
  onFrameDrawn?: () => void
  fadeOpacity?: number
  captureActive?: boolean
}

const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

function clampTransform(t: SourceTransform): SourceTransform {
  const width = Math.max(1, Math.min(100, t.width))
  const height = Math.max(1, Math.min(100, t.height))
  const x = Math.max(0, Math.min(100 - width, t.x))
  const y = Math.max(0, Math.min(100 - height, t.y))
  return { ...t, x, y, width, height }
}

function applyResize(
  handle: ResizeHandle,
  orig: SourceTransform,
  dx: number,
  dy: number
): SourceTransform {
  let { x, y, width, height } = orig

  if (handle.includes('e')) width = orig.width + dx
  if (handle.includes('w')) {
    x = orig.x + dx
    width = orig.width - dx
  }
  if (handle.includes('s')) height = orig.height + dy
  if (handle.includes('n')) {
    y = orig.y + dy
    height = orig.height - dy
  }

  return clampTransform({ ...orig, x, y, width, height })
}

export default function Preview({
  sources,
  selectedSourceId,
  onSelectSource,
  onUpdateSource,
  chatMessages,
  activeAlerts,
  streamsRef,
  canvasRef,
  resolution,
  targetFps = 30,
  onFps,
  onFrameDrawn,
  fadeOpacity = 1,
  captureActive = false
}: PreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ sourceId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const resizeRef = useRef<{
    sourceId: string
    handle: ResizeHandle
    startX: number
    startY: number
    orig: SourceTransform
  } | null>(null)

  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null)

  const [outW, outH] = useMemo(() => {
    const [w, h] = resolution.split('x').map(Number)
    return [w > 0 ? w : 1920, h > 0 ? h : 1080]
  }, [resolution])

  const { updatePreviewState } = usePreviewLoop(
    canvasRef,
    streamsRef,
    targetFps,
    onFps,
    onFrameDrawn,
    { captureActive }
  )

  useEffect(() => {
    updatePreviewState({ sources, selectedSourceId, chatMessages, activeAlerts })
  }, [sources, selectedSourceId, chatMessages, activeAlerts, updatePreviewState])

  const visibleSources = sources
    .filter((s) => s.visible && s.type !== 'chat' && s.type !== 'alert')
    .sort((a, b) => a.transform.zIndex - b.transform.zIndex)

  const widgetSources = sources
    .filter((s) => s.visible && (s.type === 'chat' || s.type === 'alert'))
    .sort((a, b) => a.transform.zIndex - b.transform.zIndex)

  const selectedSource = sources.find((s) => s.id === selectedSourceId) ?? null
  const showResizeHandles =
    selectedSource &&
    !selectedSource.locked &&
    selectedSource.type !== 'chat' &&
    selectedSource.type !== 'alert'

  const pointerPercent = (e: React.MouseEvent | MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { mx: 0, my: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      mx: ((e.clientX - rect.left) / rect.width) * 100,
      my: ((e.clientY - rect.top) / rect.height) * 100
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (resizeRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const { mx, my } = pointerPercent(e)

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
    const { mx, my } = pointerPercent(e)

    if (resizeRef.current) {
      const { sourceId, handle, startX, startY, orig } = resizeRef.current
      const dx = mx - startX
      const dy = my - startY
      onUpdateSource(sourceId, { transform: applyResize(handle, orig, dx, dy) })
      return
    }

    if (!dragRef.current) return
    const dx = mx - dragRef.current.startX
    const dy = my - dragRef.current.startY
    const source = sources.find((s) => s.id === dragRef.current!.sourceId)
    if (!source) return

    onUpdateSource(dragRef.current.sourceId, {
      transform: clampTransform({
        ...source.transform,
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy
      })
    })
  }

  const handleMouseUp = useCallback(() => {
    dragRef.current = null
    resizeRef.current = null
  }, [])

  const captureSnapshot = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const path = await window.novaStream.dialog.saveImage(canvas.toDataURL('image/png'))
      if (path) {
        setSnapshotMsg('Capture enregistrée')
        setTimeout(() => setSnapshotMsg(null), 2500)
      }
    } catch {
      setSnapshotMsg('Erreur capture')
      setTimeout(() => setSnapshotMsg(null), 2500)
    }
  }

  const startResize = (e: React.MouseEvent, handle: ResizeHandle) => {
    e.stopPropagation()
    if (!selectedSource || selectedSource.locked) return
    const { mx, my } = pointerPercent(e)
    resizeRef.current = {
      sourceId: selectedSource.id,
      handle,
      startX: mx,
      startY: my,
      orig: { ...selectedSource.transform }
    }
  }

  return (
    <div className="preview-area">
      <div className="preview-toolbar">
        <span className="preview-label">Aperçu</span>
        <div className="preview-toolbar-right">
          {snapshotMsg && <span className="preview-snapshot-msg">{snapshotMsg}</span>}
          <button type="button" className="preview-snapshot-btn" onClick={captureSnapshot} title="Capturer l'aperçu">
            📷
          </button>
          <span className="preview-res">{outW} × {outH}</span>
        </div>
      </div>
      <div className="preview-viewport" ref={containerRef}>
        <div
          className="preview-stage"
          style={{ opacity: fadeOpacity, transition: fadeOpacity === 1 ? 'none' : undefined }}
        >
          <canvas
            ref={canvasRef}
            width={outW}
            height={outH}
            className="preview-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
          {showResizeHandles && selectedSource && (
            <div
              className="preview-source-overlay"
              style={{
                left: `${selectedSource.transform.x}%`,
                top: `${selectedSource.transform.y}%`,
                width: `${selectedSource.transform.width}%`,
                height: `${selectedSource.transform.height}%`
              }}
            >
              {HANDLES.map((handle) => (
                <span
                  key={handle}
                  className={`preview-handle preview-handle-${handle}`}
                  onMouseDown={(e) => startResize(e, handle)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
