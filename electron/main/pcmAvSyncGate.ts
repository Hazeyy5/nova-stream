import type { Writable } from 'stream'
import { MIC_AUDIO_PCM } from './micAudioCapture'

const PCM_BYTES_PER_SECOND =
  MIC_AUDIO_PCM.sampleRate * MIC_AUDIO_PCM.channels * 2

/** Tampon max avant retrait progressif d'un seul chunk ancien. */
const MAX_BUFFER_MS = 3200
const WARMUP_BYTES = Math.floor((PCM_BYTES_PER_SECOND * 120) / 1000)

export class PcmAvSyncGate {
  private micChunks: Buffer[] = []
  private micBytes = 0
  private desktopChunks: Buffer[] = []
  private desktopBytes = 0
  private warmedUp = false
  private silenceBuf: Buffer | null = null

  reset(): void {
    this.micChunks = []
    this.micBytes = 0
    this.desktopChunks = []
    this.desktopBytes = 0
    this.warmedUp = false
  }

  pushMic(chunk: Buffer): void {
    if (chunk.length === 0) return
    this.micChunks.push(chunk)
    this.micBytes += chunk.length
    this.dropOneOldestIfOverflow('mic')
  }

  pushDesktop(chunk: Buffer): void {
    if (chunk.length === 0) return
    this.desktopChunks.push(chunk)
    this.desktopBytes += chunk.length
    this.dropOneOldestIfOverflow('desktop')
  }

  hasWarmupBuffer(): boolean {
    return this.micBytes >= WARMUP_BYTES || this.desktopBytes >= WARMUP_BYTES
  }

  releaseForVideoTick(
    durationMs: number,
    sinks: { mic?: Writable | null; desktop?: Writable | null }
  ): boolean {
    const tickMs = Math.max(0, durationMs)
    if (tickMs === 0) return true

    if (!this.warmedUp) {
      if (!this.hasWarmupBuffer()) return false
      this.warmedUp = true
    }

    const bytes = Math.round((PCM_BYTES_PER_SECOND * tickMs) / 1000)
    if (bytes === 0) return true

    if (sinks.mic) {
      this.writeBytes(this.micChunks, bytes, sinks.mic, (n) => { this.micBytes -= n })
    }
    if (sinks.desktop) {
      this.writeBytes(this.desktopChunks, bytes, sinks.desktop, (n) => { this.desktopBytes -= n })
    }
    return true
  }

  private dropOneOldestIfOverflow(kind: 'mic' | 'desktop'): void {
    const maxBytes = Math.floor((PCM_BYTES_PER_SECOND * MAX_BUFFER_MS) / 1000)
    if (kind === 'mic') {
      if (this.micBytes <= maxBytes || this.micChunks.length === 0) return
      const dropped = this.micChunks.shift()!
      this.micBytes -= dropped.length
      return
    }
    if (this.desktopBytes <= maxBytes || this.desktopChunks.length === 0) return
    const dropped = this.desktopChunks.shift()!
    this.desktopBytes -= dropped.length
  }

  private silence(size: number): Buffer {
    if (!this.silenceBuf || this.silenceBuf.length < size) {
      this.silenceBuf = Buffer.alloc(size)
    } else {
      this.silenceBuf.fill(0, 0, size)
    }
    return this.silenceBuf.subarray(0, size)
  }

  private writeBytes(
    queue: Buffer[],
    bytesNeeded: number,
    sink: Writable,
    onConsumed: (bytes: number) => void
  ): void {
    if (sink.destroyed || !sink.writable) return

    let remaining = bytesNeeded

    while (remaining > 0 && queue.length > 0) {
      const head = queue[0]
      if (head.length <= remaining) {
        if (!sink.write(head)) {
          sink.once('drain', () => { /* reprend */ })
        }
        onConsumed(head.length)
        queue.shift()
        remaining -= head.length
      } else {
        const slice = head.subarray(0, remaining)
        if (!sink.write(slice)) {
          sink.once('drain', () => { /* reprend */ })
        }
        queue[0] = head.subarray(remaining)
        onConsumed(remaining)
        remaining = 0
      }
    }

    if (remaining > 0) {
      const pad = Buffer.from(this.silence(remaining))
      if (!sink.write(pad)) {
        sink.once('drain', () => { /* reprend */ })
      }
    }
  }
}
