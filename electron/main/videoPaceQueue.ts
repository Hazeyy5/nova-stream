/** Durée d'un chunk MediaRecorder WebM — doit correspondre à videoPipeEncoder.ts */
export const WEBM_CHUNK_DURATION_MS = 100

/** Pré-démarrage audio avant le 1er frame vidéo (latence dshow / WASAPI). */
export const AUDIO_CAPTURE_LEAD_MS = 100

export type VideoPaceMode = 'frame' | 'timed'

export interface VideoPaceOptions {
  paceMode?: VideoPaceMode
  chunkDurationMs?: number
  audioLeadMs?: number
}

/**
 * Cadence les chunks vidéo en temps réel pour que FFmpeg assigne des PTS cohérents
 * avec l'audio PCM (comme OBS — horloge commune, pas de adelay fixe).
 */
export class VideoPaceQueue {
  private queue: Array<{ buffer: Buffer; sendAtMs: number }> = []
  private draining = false
  private fps = 30
  private paceMode: VideoPaceMode = 'frame'
  private chunkDurationMs = WEBM_CHUNK_DURATION_MS
  private audioLeadMs = AUDIO_CAPTURE_LEAD_MS
  private sessionStartMono: number | null = null
  private frameIndex = 0
  private writeFn: (buf: Buffer) => void = () => {}
  private onSessionStart: () => void = () => {}

  configure(
    fps: number,
    writeFn: (buf: Buffer) => void,
    onSessionStart: () => void,
    options: VideoPaceOptions = {}
  ): void {
    this.fps = Math.max(1, fps)
    this.writeFn = writeFn
    this.onSessionStart = onSessionStart
    this.paceMode = options.paceMode ?? 'frame'
    this.chunkDurationMs = Math.max(1, options.chunkDurationMs ?? WEBM_CHUNK_DURATION_MS)
    this.audioLeadMs = Math.max(0, options.audioLeadMs ?? AUDIO_CAPTURE_LEAD_MS)
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
      this.onSessionStart()
      this.sessionStartMono = this.audioLeadMs > 0 ? now + this.audioLeadMs : now
      if (this.audioLeadMs > 0) {
        setTimeout(() => {
          this.writeFn(chunk)
          this.advanceFrameIndex()
        }, this.audioLeadMs)
      } else {
        this.writeFn(chunk)
        this.advanceFrameIndex()
      }
      return
    }

    const frameDurationMs = 1000 / this.fps
    const sendAtMs = this.sessionStartMono + this.frameIndex * frameDurationMs
    this.advanceFrameIndex()
    this.queue.push({ buffer: chunk, sendAtMs: Math.max(now, sendAtMs) })
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
