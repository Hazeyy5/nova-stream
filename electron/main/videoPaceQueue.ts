/** Durée d'un chunk MediaRecorder WebM — doit correspondre à videoPipeEncoder.ts */
export const WEBM_CHUNK_DURATION_MS = 66

/** Si la timeline vidéo accuse plus de retard que ça, on resynchronise sur l'horloge murale. */
const DRIFT_RESYNC_THRESHOLD_MS = 180

export type VideoPaceMode = 'frame' | 'timed'

export interface VideoPaceOptions {
  paceMode?: VideoPaceMode
  chunkDurationMs?: number
}

/**
 * Cadence la vidéo en temps réel et resynchronise si le débit encodeur
 * prend du retard (évite que l'audio prenne de l'avance au fil du live).
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
    const frameDurationMs = 1000 / this.fps

    if (this.sessionStartMono === null) {
      this.sessionStartMono = now
      this.onFirstMuxFrame()
      this.writeFn(chunk)
      this.advanceFrameIndex(frameDurationMs)
      return
    }

    this.correctDrift(now, frameDurationMs)

    const scheduledTime = this.sessionStartMono + this.frameIndex * frameDurationMs
    this.advanceFrameIndex(frameDurationMs)

    if (scheduledTime <= now) {
      this.writeFn(chunk)
      return
    }

    this.queue.push({ buffer: chunk, sendAtMs: scheduledTime })
    this.scheduleDrain()
  }

  private correctDrift(now: number, frameDurationMs: number): void {
    const wallElapsed = now - this.sessionStartMono!
    const contentElapsed = this.frameIndex * frameDurationMs
    const drift = wallElapsed - contentElapsed

    if (drift > DRIFT_RESYNC_THRESHOLD_MS) {
      this.frameIndex = Math.floor(wallElapsed / frameDurationMs)
      const cutoff = now - frameDurationMs * 3
      this.queue = this.queue.filter((item) => item.sendAtMs >= cutoff)
    } else if (drift < -frameDurationMs * 4 && this.queue.length > 0) {
      // Vidéo en avance : on vide les frames trop anciennes en file
      const cutoff = now + frameDurationMs
      while (this.queue.length > 0 && this.queue[0].sendAtMs < cutoff) {
        this.writeFn(this.queue.shift()!.buffer)
      }
    }
  }

  private advanceFrameIndex(frameDurationMs: number): void {
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
    const frameDurationMs = 1000 / this.fps
    this.correctDrift(now, frameDurationMs)
    while (this.queue.length > 0 && this.queue[0].sendAtMs <= now) {
      this.writeFn(this.queue.shift()!.buffer)
    }
  }
}

function monotonicMs(): number {
  return Number(process.hrtime.bigint() / 1_000_000n)
}
