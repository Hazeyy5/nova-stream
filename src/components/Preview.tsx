import { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import type { Source, ChatMessage, StreamAlert, SourceTransform, WidgetLiveData } from '../types'
import { isCanvasWidget } from '../lib/widgetTypes'
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
  widgetLiveData?: WidgetLiveData
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
  dy: number,
  lockAspect = false
): SourceTransform {
  if (lockAspect) {
    return applyAspectLockedResize(handle, orig, dx, dy)
  }

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

function applyAspectLockedResize(
  handle: ResizeHandle,
  orig: SourceTransform,
  dx: number,
  dy: number
): SourceTransform {
  const ratio = orig.width / orig.height
  let x = orig.x
  let y = orig.y
  let width = orig.width
  let height = orig.height

  if (handle === 'e') {
    width = orig.width + dx
    height = width / ratio
    y = orig.y + (orig.height - height) / 2
  } else if (handle === 'w') {
    width = orig.width - dx
    height = width / ratio
    x = orig.x + dx
    y = orig.y + (orig.height - height) / 2
  } else if (handle === 's') {
    height = orig.height + dy
    width = height * ratio
    x = orig.x + (orig.width - width) / 2
  } else if (handle === 'n') {
    height = orig.height - dy
    width = height * ratio
    x = orig.x + (orig.width - width) / 2
    y = orig.y + dy
  } else if (handle === 'se') {
    const scale = Math.max((orig.width + dx) / orig.width, (orig.height + dy) / orig.height)
    width = orig.width * scale
    height = orig.height * scale
  } else if (handle === 'nw') {
    const scale = Math.max((orig.width - dx) / orig.width, (orig.height - dy) / orig.height)
    width = orig.width * scale
    height = orig.height * scale
    x = orig.x + orig.width - width
    y = orig.y + orig.height - height
  } else if (handle === 'ne') {
    const scale = Math.max((orig.width + dx) / orig.width, (orig.height - dy) / orig.height)
    width = orig.width * scale
    height = orig.height * scale
    y = orig.y + orig.height - height
  } else if (handle === 'sw') {
    const scale = Math.max((orig.width - dx) / orig.width, (orig.height + dy) / orig.height)
    width = orig.width * scale
    height = orig.height * scale
    x = orig.x + orig.width - width
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
  widgetLiveData,
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
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ sourceId: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const resizeRef = useRef<{
    sourceId: string
    handle: ResizeHandle
    startX: number
    startY: number
    orig: SourceTransform
  } | null>(null)
  const pointerCaptureRef = useRef<{ el: HTMLElement; pointerId: number } | null>(null)

  const releasePointerCapture = useCallback(() => {
    const capture = pointerCaptureRef.current
    if (capture?.el.hasPointerCapture(capture.pointerId)) {
      capture.el.releasePointerCapture(capture.pointerId)
    }
    pointerCaptureRef.current = null
  }, [])

  const acquirePointerCapture = useCallback((el: HTMLElement | null, pointerId: number) => {
    if (!el?.setPointerCapture) return
    releasePointerCapture()
    try {
      el.setPointerCapture(pointerId)
      pointerCaptureRef.current = { el, pointerId }
    } catch {
      /* ignore */
    }
  }, [releasePointerCapture])

  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null)
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })

  const [outW, outH] = useMemo(() => {
    const [w, h] = resolution.split('x').map(Number)
    return [w > 0 ? w : 1920, h > 0 ? h : 1080]
  }, [resolution])

  const aspectRatio = outW / outH

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const fitStage = () => {
      const cw = container.clientWidth
      const ch = container.clientHeight
      if (cw <= 0 || ch <= 0) return

      let w = cw
      let h = cw / aspectRatio
      if (h > ch) {
        h = ch
        w = h * aspectRatio
      }

      setStageSize({
        w: Math.max(1, Math.floor(w)),
        h: Math.max(1, Math.floor(h))
      })
    }

    fitStage()
    const observer = new ResizeObserver(fitStage)
    observer.observe(container)
    return () => observer.disconnect()
  }, [aspectRatio])

  const { updatePreviewState } = usePreviewLoop(
    canvasRef,
    streamsRef,
    targetFps,
    onFps,
    onFrameDrawn,
    { captureActive }
  )

  useEffect(() => {
    updatePreviewState({ sources, selectedSourceId, chatMessages, activeAlerts, widgetLiveData })
  }, [sources, selectedSourceId, chatMessages, activeAlerts, widgetLiveData, updatePreviewState])

  const interactiveSources = useMemo(
    () =>
      sources
        .filter((s) => s.visible)
        .sort((a, b) => b.transform.zIndex - a.transform.zIndex),
    [sources]
  )

  const selectedSource = sources.find((s) => s.id === selectedSourceId) ?? null
  const showResizeHandles =
    !captureActive &&
    selectedSource &&
    !selectedSource.locked

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

    const hit = interactiveSources.find((s) => {
      const t = s.transform
      return mx >= t.x && mx <= t.x + t.width && my >= t.y && my <= t.y + t.height
    })

    if (hit) {
      onSelectSource(hit.id)
      if (hit.locked) return
      dragRef.current = { sourceId: hit.id, startX: mx, startY: my, origX: hit.transform.x, origY: hit.transform.y }
      acquirePointerCapture(stageRef.current, e.pointerId)
      e.preventDefault()
    }
  }

  const handleMouseMove = useCallback((e: React.MouseEvent | MouseEvent) => {
    const { mx, my } = pointerPercent(e)

    if (resizeRef.current) {
      const { sourceId, handle, startX, startY, orig } = resizeRef.current
      const dx = mx - startX
      const dy = my - startY
      onUpdateSource(sourceId, { transform: applyResize(handle, orig, dx, dy, e.shiftKey) })
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
  }, [sources, onUpdateSource])

  const handleMouseUp = useCallback(() => {
    releasePointerCapture()
    dragRef.current = null
    resizeRef.current = null
  }, [releasePointerCapture])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current && !resizeRef.current) return
      handleMouseMove(e)
    }
    const onUp = () => handleMouseUp()

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [handleMouseMove, handleMouseUp])

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
    e.preventDefault()
    if (!selectedSource || selectedSource.locked) return
    const { mx, my } = pointerPercent(e)
    resizeRef.current = {
      sourceId: selectedSource.id,
      handle,
      startX: mx,
      startY: my,
      orig: { ...selectedSource.transform }
    }
    acquirePointerCapture(stageRef.current, e.pointerId)
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
          ref={stageRef}
          className="preview-stage"
          style={{
            width: stageSize.w > 0 ? stageSize.w : undefined,
            height: stageSize.h > 0 ? stageSize.h : undefined,
            opacity: fadeOpacity,
            transition: fadeOpacity === 1 ? 'none' : 'opacity 0.05s linear'
          }}
        >
          <canvas
            ref={canvasRef}
            width={outW}
            height={outH}
            className="preview-canvas"
            onMouseDown={handleMouseDown}
          />
          {showResizeHandles && selectedSource && (
            <div
              className={`preview-source-overlay${isCanvasWidget(selectedSource.type) ? ' preview-source-overlay-widget' : ''}`}
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
