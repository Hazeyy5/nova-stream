import { useEffect, useRef, useCallback, type RefObject } from 'react'
import type { ChatMessage, Source, StreamAlert, WidgetLiveData } from '../types'
import { DEFAULT_WIDGET_LIVE_DATA } from '../types'
import { drawScene, type StreamEntry } from '../lib/drawScene'
import { resolvePreviewFps, sortVisibleLayers } from '../lib/previewLayers'

interface PreviewState {
  layers: Source[]
  selectedSourceId: string | null
  chatMessages: ChatMessage[]
  activeAlerts: StreamAlert[]
  chatSlice: ChatMessage[]
  widgetLiveData: WidgetLiveData
}

interface PreviewLoopOptions {
  captureActive?: boolean
}

export function usePreviewLoop(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  streamsRef: RefObject<Map<string, StreamEntry>>,
  targetFps = 30,
  onFps?: (fps: number) => void,
  onFrameDrawn?: () => void,
  options: PreviewLoopOptions = {}
) {
  const stateRef = useRef<PreviewState>({
    layers: [],
    selectedSourceId: null,
    chatMessages: [],
    activeAlerts: [],
    chatSlice: [],
    widgetLiveData: DEFAULT_WIDGET_LIVE_DATA
  })

  const captureActiveRef = useRef(options.captureActive ?? false)
  captureActiveRef.current = options.captureActive ?? false

  const updatePreviewState = useCallback((partial: {
    sources?: Source[]
    selectedSourceId?: string | null
    chatMessages?: ChatMessage[]
    activeAlerts?: StreamAlert[]
    widgetLiveData?: WidgetLiveData
  }) => {
    const state = stateRef.current
    if (partial.sources) {
      state.layers = sortVisibleLayers(partial.sources)
    }
    if (partial.selectedSourceId !== undefined) {
      state.selectedSourceId = partial.selectedSourceId
    }
    if (partial.chatMessages) {
      state.chatMessages = partial.chatMessages
      state.chatSlice = partial.chatMessages.slice(-20)
    }
    if (partial.activeAlerts) {
      state.activeAlerts = partial.activeAlerts
    }
    if (partial.widgetLiveData) {
      state.widgetLiveData = partial.widgetLiveData
    }
  }, [])

  const onFpsRef = useRef(onFps)
  onFpsRef.current = onFps
  const onFrameDrawnRef = useRef(onFrameDrawn)
  onFrameDrawnRef.current = onFrameDrawn

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', {
      alpha: false,
      willReadFrequently: false
    })
    if (!ctx) return

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    let raf = 0
    let lastDraw = 0
    let nextCaptureFrameAt = 0
    let frameCount = 0
    let fpsReportAt = performance.now()

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)

      if (document.hidden) return

      const state = stateRef.current
      const fps = resolvePreviewFps(
        state.layers,
        targetFps,
        captureActiveRef.current,
        state.activeAlerts
      )
      const frameInterval = 1000 / fps
      const capturing = captureActiveRef.current

      if (capturing) {
        if (nextCaptureFrameAt === 0) nextCaptureFrameAt = now
        if (now < nextCaptureFrameAt) return
        // Resync sans rafale si on a pris du retard (onglet masqué, charge CPU…)
        if (now - nextCaptureFrameAt > frameInterval * 4) {
          nextCaptureFrameAt = now
        } else {
          nextCaptureFrameAt += frameInterval
        }
      } else {
        if (now - lastDraw < frameInterval) return
        lastDraw = now
        nextCaptureFrameAt = 0
      }
      drawScene(ctx, canvas, state.layers, streamsRef.current!, {
        chatMessages: state.chatSlice,
        activeAlerts: state.activeAlerts,
        frameTime: Date.now(),
        widgetLiveData: state.widgetLiveData
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
