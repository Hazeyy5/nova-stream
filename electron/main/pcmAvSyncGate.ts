import type { Writable } from 'stream'
import { MIC_AUDIO_PCM } from './micAudioCapture'

const PCM_BYTES_PER_SECOND =
  MIC_AUDIO_PCM.sampleRate * MIC_AUDIO_PCM.channels * 2

/** Limite la latence si la vidéo ralentit temporairement (ms). */
const MAX_BUFFER_MS = 2500

export class PcmAvSyncGate {
  private micChunks: Buffer[] = []
  private micBytes = 0
  private desktopChunks: Buffer[] = []
  private desktopBytes = 0

  reset(): void {
    this.micChunks = []
    this.micBytes = 0
    this.desktopChunks = []
    this.desktopBytes = 0
  }

  pushMic(chunk: Buffer): void {
    if (chunk.length === 0) return
    this.micChunks.push(chunk)
    this.micBytes += chunk.length
    this.trimBuffer('mic')
  }

  pushDesktop(chunk: Buffer): void {
    if (chunk.length === 0) return
    this.desktopChunks.push(chunk)
    this.desktopBytes += chunk.length
    this.trimBuffer('desktop')
  }

  /**
   * Libère exactement `durationMs` d'audio PCM pour accompagner un chunk vidéo.
   * L'audio ne peut plus prendre de l'avance sur la timeline vidéo.
   */
  releaseForVideoTick(
    durationMs: number,
    sinks: { mic?: Writable | null; desktop?: Writable | null }
  ): void {
    const bytes = Math.max(0, Math.round((PCM_BYTES_PER_SECOND * durationMs) / 1000))
    if (bytes === 0) return

    if (sinks.mic) {
      this.writeBytes(this.micChunks, bytes, sinks.mic, (n) => { this.micBytes -= n })
    }
    if (sinks.desktop) {
      this.writeBytes(this.desktopChunks, bytes, sinks.desktop, (n) => { this.desktopBytes -= n })
    }
  }

  private trimBuffer(kind: 'mic' | 'desktop'): void {
    const maxBytes = Math.floor((PCM_BYTES_PER_SECOND * MAX_BUFFER_MS) / 1000)
    if (kind === 'mic') {
      while (this.micBytes > maxBytes && this.micChunks.length > 0) {
        const dropped = this.micChunks.shift()!
        this.micBytes -= dropped.length
      }
      return
    }
    while (this.desktopBytes > maxBytes && this.desktopChunks.length > 0) {
      const dropped = this.desktopChunks.shift()!
      this.desktopBytes -= dropped.length
    }
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
