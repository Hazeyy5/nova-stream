import { useRef, useCallback, type RefObject } from 'react'
import type { ChatMessage, Source, StreamSettings, StreamAlert } from '../types'
import { drawScene, type StreamEntry } from '../lib/drawScene'

export interface LiveCaptureState {
  sources: Source[]
  settings: StreamSettings
  chatMessages: ChatMessage[]
  activeAlerts: StreamAlert[]
}

function pickMimeType(): string {
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm'
}

export function useSceneCapture(
  streamsRef: RefObject<Map<string, StreamEntry>>
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const animRef = useRef<number>(0)
  const activeRef = useRef(false)
  const liveStateRef = useRef<LiveCaptureState | null>(null)

  const ensureCanvas = (resolution: string) => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
    const [w, h] = resolution.split('x').map(Number)
    if (canvasRef.current.width !== w || canvasRef.current.height !== h) {
      canvasRef.current.width = w
      canvasRef.current.height = h
    }
    return canvasRef.current
  }

  const startDrawLoop = useCallback(() => {
    let lastDraw = 0

    const draw = (now: number) => {
      animRef.current = requestAnimationFrame(draw)
      if (!activeRef.current || !liveStateRef.current) return

      const fps = liveStateRef.current.settings.framerate || 30
      const interval = 1000 / fps
      if (now - lastDraw < interval) return
      lastDraw = now

      const { sources, settings, chatMessages, activeAlerts } = liveStateRef.current
      const canvas = ensureCanvas(settings.resolution)
      const ctx = canvas.getContext('2d', { alpha: false })
      if (!ctx || !streamsRef.current) return

      drawScene(ctx, canvas, sources, streamsRef.current, {
        chatMessages,
        activeAlerts
      })
    }

    cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(draw)
  }, [streamsRef])

  const waitForFrames = useCallback((timeoutMs = 3000) => {
    return new Promise<void>((resolve) => {
      const start = Date.now()
      const check = () => {
        const map = streamsRef.current
        const hasFrame = map && [...map.values()].some((e) => e.video && e.video.readyState >= 2)
        if (hasFrame || Date.now() - start > timeoutMs) resolve()
        else requestAnimationFrame(check)
      }
      check()
    })
  }, [streamsRef])

  const updateLiveState = useCallback((state: LiveCaptureState) => {
    liveStateRef.current = state
  }, [])

  const beginPipe = useCallback((videoBitrate: number) => {
    const canvas = canvasRef.current
    if (!canvas) throw new Error('Capture non initialisée')

    const stream = canvas.captureStream(30)
    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: videoBitrate * 1000
    })

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        event.data.arrayBuffer().then((buf) => {
          window.novaStream.media.sendVideoChunk(new Uint8Array(buf))
        })
      }
    }

    recorder.start(250)
    recorderRef.current = recorder
  }, [])

  const arm = useCallback(async (initial: LiveCaptureState) => {
    liveStateRef.current = initial
    activeRef.current = true
    await waitForFrames()
    startDrawLoop()
  }, [startDrawLoop, waitForFrames])

  const disarm = useCallback(async () => {
    activeRef.current = false
    liveStateRef.current = null
    cancelAnimationFrame(animRef.current)

    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve()
        recorder.stop()
        setTimeout(resolve, 800)
      })
    }
  }, [])

  return { arm, beginPipe, disarm, updateLiveState }
}
