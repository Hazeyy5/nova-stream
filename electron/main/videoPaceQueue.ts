/** Durée d'un chunk MediaRecorder WebM — doit correspondre à videoPipeEncoder.ts */
export const WEBM_CHUNK_DURATION_MS = 100

export type VideoPaceMode = 'frame' | 'timed'

export interface VideoPaceOptions {
  paceMode?: VideoPaceMode
  chunkDurationMs?: number
}

/**
 * Limite la vidéo pour qu'elle ne parte pas en avance sur l'horloge temps réel (style OBS).
 * Si des frames arrivent en retard ou en rafale, elles sont envoyées immédiatement au muxer.
 */
export class VideoPaceQueue {
  private queue: Array<{ buffer: Buffer; sendAtMs: number }> = []
  private draining = false
  private fps = 30
  private paceMode: VideoPaceMode = 'frame'
  private chunkDurationMs = WEBM_CHUNK_DURATION_MS
  private sessionStartMono: number | null = null
  private frameIndex = 0
  private writeFn: (buf: Buffer) => void = () => {}
  private onFirstMuxFrame: () => void = () => {}

  configure(
    fps: number,
    writeFn: (buf: Buffer) => void,
    onFirstMuxFrame: () => void,
    options: VideoPaceOptions = {}
  ): void {
    this.fps = Math.max(1, fps)
    this.writeFn = writeFn
    this.onFirstMuxFrame = onFirstMuxFrame
    this.paceMode = options.paceMode ?? 'frame'
    this.chunkDurationMs = Math.max(1, options.chunkDurationMs ?? WEBM_CHUNK_DURATION_MS)
  }

  reset(): void {
    this.queue = []
    this.sessionStartMono = null
    this.frameIndex = 0
    this.draining = false
  }

  push(chunk: Buffer): void {
    if (chunk.length === 0) return

    const now = monotonicMs()
    if (this.sessionStartMono === null) {
      this.sessionStartMono = now
      this.onFirstMuxFrame()
      this.writeFn(chunk)
      this.advanceFrameIndex()
      return
    }

    const frameDurationMs = 1000 / this.fps
    const scheduledTime = this.sessionStartMono + this.frameIndex * frameDurationMs
    this.advanceFrameIndex()

    if (scheduledTime <= now) {
      this.writeFn(chunk)
      return
    }

    this.queue.push({ buffer: chunk, sendAtMs: scheduledTime })
    this.scheduleDrain()
  }

  private advanceFrameIndex(): void {
    const frameDurationMs = 1000 / this.fps
    const advance = this.paceMode === 'timed'
      ? this.chunkDurationMs / frameDurationMs
      : 1
    this.frameIndex += advance
  }

  private scheduleDrain(): void {
    if (this.draining) return
    this.draining = true
    const tick = () => {
      this.drain()
      if (this.queue.length > 0) {
        setImmediate(tick)
      } else {
        this.draining = false
      }
    }
    setImmediate(tick)
  }

  private drain(): void {
    const now = monotonicMs()
    while (this.queue.length > 0 && this.queue[0].sendAtMs <= now) {
      this.writeFn(this.queue.shift()!.buffer)
    }
  }
}

function monotonicMs(): number {
  return Number(process.hrtime.bigint() / 1_000_000n)
}
