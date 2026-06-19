import type { Writable } from 'stream'
import { MIC_AUDIO_PCM } from './micAudioCapture'

const PCM_BYTES_PER_SECOND =
  MIC_AUDIO_PCM.sampleRate * MIC_AUDIO_PCM.channels * 2

/** Au-delà, on retire un seul chunk ancien (pas de rognage brutal). */
const MAX_BUFFER_MS = 2800

export class PcmAvSyncGate {
  private micChunks: Buffer[] = []
  private micBytes = 0
  private desktopChunks: Buffer[] = []
  private desktopBytes = 0
  private skipPreRoll = true

  reset(): void {
    this.micChunks = []
    this.micBytes = 0
    this.desktopChunks = []
    this.desktopBytes = 0
    this.skipPreRoll = true
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

  /**
   * Libère exactement `durationMs` d'audio PCM pour accompagner un chunk vidéo.
   */
  releaseForVideoTick(
    durationMs: number,
    sinks: { mic?: Writable | null; desktop?: Writable | null }
  ): void {
    if (this.skipPreRoll) {
      this.skipPreRoll = false
      this.clearBuffers()
    }

    const tickMs = Math.max(0, durationMs)
    if (tickMs === 0) return

    const bytes = Math.round((PCM_BYTES_PER_SECOND * tickMs) / 1000)
    if (bytes === 0) return

    if (sinks.mic) {
      this.writeBytes(this.micChunks, bytes, sinks.mic, (n) => { this.micBytes -= n })
    }
    if (sinks.desktop) {
      this.writeBytes(this.desktopChunks, bytes, sinks.desktop, (n) => { this.desktopBytes -= n })
    }
  }

  private clearBuffers(): void {
    this.micChunks = []
    this.micBytes = 0
    this.desktopChunks = []
    this.desktopBytes = 0
  }

  /** Retire au plus un chunk si le tampon déborde — évite les pops du rognage massif. */
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

  private writeBytes(
    queue: Buffer[],
    bytesNeeded: number,
    sink: Writable,
    onConsumed: (bytes: number) => void
  ): void {
    if (sink.destroyed || !sink.writable) return

    let remaining = bytesNeeded
    const parts: Buffer[] = []

    while (remaining > 0 && queue.length > 0) {
      const head = queue[0]
      if (head.length <= remaining) {
        parts.push(queue.shift()!)
        remaining -= head.length
        onConsumed(head.length)
      } else {
        parts.push(head.subarray(0, remaining))
        queue[0] = head.subarray(remaining)
        onConsumed(remaining)
        remaining = 0
      }
    }

    if (remaining > 0) {
      parts.push(Buffer.alloc(remaining))
    }

    const out = Buffer.concat(parts)
    if (out.length === 0) return

    const ok = sink.write(out)
    if (!ok) {
      sink.once('drain', () => { /* reprend */ })
    }
  }
}
