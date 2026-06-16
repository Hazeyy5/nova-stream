import { useRef, useCallback, type RefObject } from 'react'
import type { StreamEntry } from '../lib/drawScene'
import { VideoPipeEncoder, type VideoInputFormat } from '../lib/videoPipeEncoder'

const noopChunk: (chunk: Uint8Array) => void = () => {}

export function useSceneCapture(
  streamsRef: RefObject<Map<string, StreamEntry>>,
  canvasRef: RefObject<HTMLCanvasElement | null>
) {
  const encoderRef = useRef<VideoPipeEncoder | null>(null)
  const pendingVideoChunksRef = useRef(0)
  const pipeConnectedRef = useRef(false)
  const videoBitrateRef = useRef(6000)
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

  /** Détecte H264/WebM sans envoyer de vidéo au muxer (style OBS — FFmpeg d'abord). */
  const prepareEncoder = useCallback(async (videoBitrate: number, framerate: number): Promise<VideoInputFormat> => {
    const canvas = canvasRef.current
    if (!canvas) throw new Error('Canvas non disponible')

    videoBitrateRef.current = videoBitrate
    const encoder = new VideoPipeEncoder()
    const format = await encoder.start({
      canvas,
      framerate,
      bitrateKbps: videoBitrate,
      onChunk: noopChunk
    })

    if (format === 'h264') {
      encodeFrameRef.current = () => {
        const c = canvasRef.current
        if (c) encoder.encodeFrame(c)
      }
    } else {
      encodeFrameRef.current = () => {
        encoder.requestFrame()
      }
    }

    encoderRef.current = encoder
    videoInputFormatRef.current = format
    pipeConnectedRef.current = false
    return format
  }, [canvasRef])

  /** Branche l'encodeur sur FFmpeg une fois le muxer prêt — timeline A/V commune. */
  const connectPipe = useCallback(() => {
    const encoder = encoderRef.current
    const canvas = canvasRef.current
    if (!encoder || !canvas || pipeConnectedRef.current) return

    pipeConnectedRef.current = true
    encoder.beginCapture((chunk) => {
      pendingVideoChunksRef.current += 1
      window.novaStream.media.sendVideoChunk(chunk)
      pendingVideoChunksRef.current -= 1
    }, canvas, videoBitrateRef.current)
  }, [canvasRef])

  const getVideoInputFormat = useCallback((): VideoInputFormat => {
    return videoInputFormatRef.current
  }, [])

  const arm = useCallback(async () => {
    activeRef.current = true
    await waitForFrames()
  }, [waitForFrames])

  const disarm = useCallback(async () => {
    activeRef.current = false
    encodeFrameRef.current = null
    pipeConnectedRef.current = false

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
      encoder.setOnChunk(null)
      await encoder.stop()
      await waitForPendingChunks()
    }
  }, [])

  return { arm, prepareEncoder, connectPipe, disarm, onFrameDrawn, getVideoInputFormat }
}
