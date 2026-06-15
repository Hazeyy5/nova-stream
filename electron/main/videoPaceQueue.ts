/**
 * Cadence les chunks vidéo en temps réel pour que FFmpeg assigne des PTS cohérents
 * avec l'audio PCM (comme OBS — horloge commune, pas de adelay fixe).
 */
export class VideoPaceQueue {
  private queue: Array<{ buffer: Buffer; sendAtMs: number }> = []
  private timer: ReturnType<typeof setInterval> | null = null
  private fps = 30
  private sessionEpochMs: number | null = null
  private frameIndex = 0
  private writeFn: (buf: Buffer) => void = () => {}
  private onSessionStart: () => void = () => {}

  configure(fps: number, writeFn: (buf: Buffer) => void, onSessionStart: () => void): void {
    this.fps = Math.max(1, fps)
    this.writeFn = writeFn
    this.onSessionStart = onSessionStart
  }

  reset(): void {
    this.queue = []
    this.sessionEpochMs = null
    this.frameIndex = 0
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  push(chunk: Buffer): void {
    if (chunk.length === 0) return

    const now = Date.now()
    if (this.sessionEpochMs === null) {
      this.sessionEpochMs = now
      this.onSessionStart()
      this.writeFn(chunk)
      this.frameIndex = 1
      return
    }

    const frameDurationMs = 1000 / this.fps
    const sendAtMs = this.sessionEpochMs + this.frameIndex * frameDurationMs
    this.frameIndex += 1
    this.queue.push({ buffer: chunk, sendAtMs: Math.max(now, sendAtMs) })
    this.ensureDrainLoop()
  }

  private ensureDrainLoop(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.drain(), 4)
  }

  private drain(): void {
    const now = Date.now()
    while (this.queue.length > 0 && this.queue[0].sendAtMs <= now) {
      this.writeFn(this.queue.shift()!.buffer)
    }
    if (this.queue.length === 0 && this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
