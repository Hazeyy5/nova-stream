import { useRef, useCallback, type RefObject } from 'react'
import type { StreamEntry } from '../lib/drawScene'
import { VideoPipeEncoder, type VideoInputFormat } from '../lib/videoPipeEncoder'

export function useSceneCapture(
  streamsRef: RefObject<Map<string, StreamEntry>>,
  canvasRef: RefObject<HTMLCanvasElement | null>
) {
  const encoderRef = useRef<VideoPipeEncoder | null>(null)
  const pendingVideoChunksRef = useRef(0)
  const videoChunksSentRef = useRef(0)
  const activeRef = useRef(false)
  const encodeFrameRef = useRef<(() => void) | null>(null)
  const videoInputFormatRef = useRef<VideoInputFormat>('webm')

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

  const onFrameDrawn = useCallback(() => {
    if (!activeRef.current) return
    encodeFrameRef.current?.()
  }, [])

  const beginPipe = useCallback(async (videoBitrate: number, framerate: number): Promise<VideoInputFormat> => {
    const canvas = canvasRef.current
    if (!canvas) throw new Error('Canvas non disponible')

    const encoder = new VideoPipeEncoder()
    const format = await encoder.start({
      canvas,
      framerate,
      bitrateKbps: videoBitrate,
      onChunk: (chunk) => {
        videoChunksSentRef.current += 1
        pendingVideoChunksRef.current += 1
        window.novaStream.media.sendVideoChunk(chunk)
        pendingVideoChunksRef.current -= 1
      }
    })

    if (format === 'h264') {
      encodeFrameRef.current = () => {
        const c = canvasRef.current
        if (c) encoder.encodeFrame(c)
      }
    } else {
      encodeFrameRef.current = null
    }

    const minChunks = format === 'h264' ? 2 : 3
    await encoder.waitForChunks(minChunks, 5000)

    encoderRef.current = encoder
    videoInputFormatRef.current = format
    return format
  }, [canvasRef])

  const waitForVideoPipeReady = useCallback(async (minChunks = 2, timeoutMs = 3000) => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (videoChunksSentRef.current >= minChunks) return
      await new Promise((resolve) => setTimeout(resolve, 40))
    }
  }, [])

  const getVideoInputFormat = useCallback((): VideoInputFormat => {
    return videoInputFormatRef.current
  }, [])

  const getVideoLatencyEstimateMs = useCallback((): number => {
    return encoderRef.current?.getLatencyEstimateMs() ?? 700
  }, [])

  const arm = useCallback(async () => {
    activeRef.current = true
    await waitForFrames()
  }, [waitForFrames])

  const disarm = useCallback(async () => {
    activeRef.current = false
    encodeFrameRef.current = null

    const encoder = encoderRef.current
    encoderRef.current = null

    const waitForPendingChunks = (): Promise<void> =>
      new Promise((resolve) => {
        const tick = () => {
          if (pendingVideoChunksRef.current <= 0) resolve()
          else setTimeout(tick, 30)
        }
        tick()
      })

    if (encoder) {
      await encoder.stop()
      await waitForPendingChunks()
    }
  }, [])

  return { arm, beginPipe, waitForVideoPipeReady, disarm, onFrameDrawn, getVideoInputFormat, getVideoLatencyEstimateMs }
}
