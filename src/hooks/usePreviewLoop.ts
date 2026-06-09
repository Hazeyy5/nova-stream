import { useEffect, useRef, useCallback, type RefObject } from 'react'
import type { ChatMessage, Source, StreamAlert } from '../types'
import { drawScene, type StreamEntry } from '../lib/drawScene'

interface PreviewState {
  sources: Source[]
  selectedSourceId: string | null
  chatMessages: ChatMessage[]
  activeAlerts: StreamAlert[]
}

export function usePreviewLoop(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  streamsRef: RefObject<Map<string, StreamEntry>>,
  targetFps = 30,
  onFps?: (fps: number) => void,
  onFrameDrawn?: () => void
) {
  const stateRef = useRef<PreviewState>({
    sources: [],
    selectedSourceId: null,
    chatMessages: [],
    activeAlerts: []
  })

  const updatePreviewState = useCallback((partial: Partial<PreviewState>) => {
    Object.assign(stateRef.current, partial)
  }, [])

  const onFpsRef = useRef(onFps)
  onFpsRef.current = onFps
  const onFrameDrawnRef = useRef(onFrameDrawn)
  onFrameDrawnRef.current = onFrameDrawn

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let raf = 0
    let lastDraw = 0
    let frameCount = 0
    let fpsReportAt = performance.now()
    const frameInterval = 1000 / targetFps

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)

      if (document.hidden) return
      if (now - lastDraw < frameInterval) return

      lastDraw = now
      const state = stateRef.current
      drawScene(ctx, canvas, state.sources, streamsRef.current!, {
        selectedSourceId: state.selectedSourceId,
        chatMessages: state.chatMessages,
        activeAlerts: state.activeAlerts
      })

      onFrameDrawnRef.current?.()

      frameCount++
      if (now - fpsReportAt >= 1000) {
        onFpsRef.current?.(frameCount)
        frameCount = 0
        fpsReportAt = now
      }
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [canvasRef, streamsRef, targetFps])

  return { updatePreviewState }
}
