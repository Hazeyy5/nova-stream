import type { Writable } from 'stream'
import { MIC_AUDIO_PCM } from './micAudioCapture'

const PCM_BYTES_PER_SECOND =
  MIC_AUDIO_PCM.sampleRate * MIC_AUDIO_PCM.channels * 2

/** Tampon cible — absorbe la latence micro / bureau sans dérive. */
const TARGET_BUFFER_MS = 150
/** Au-delà, on rogne l'excédent (correction de dérive progressive). */
const MAX_BUFFER_MS = 700

export class PcmAvSyncGate {
  private micChunks: Buffer[] = []
  private micBytes = 0
  private desktopChunks: Buffer[] = []
  private desktopBytes = 0
  private awaitingFirstFrame = true
  private videoTimelineMs = 0
  private sessionWallStart = 0

  reset(): void {
    this.micChunks = []
    this.micBytes = 0
    this.desktopChunks = []
    this.desktopBytes = 0
    this.awaitingFirstFrame = true
    this.videoTimelineMs = 0
    this.sessionWallStart = 0
  }

  pushMic(chunk: Buffer): void {
    if (chunk.length === 0) return
    this.micChunks.push(chunk)
    this.micBytes += chunk.length
    this.enforceBufferBounds('mic')
  }

  pushDesktop(chunk: Buffer): void {
    if (chunk.length === 0) return
    this.desktopChunks.push(chunk)
    this.desktopBytes += chunk.length
    this.enforceBufferBounds('desktop')
  }

  /**
   * Libère exactement `durationMs` d'audio PCM pour accompagner un chunk vidéo.
   * La durée est toujours la durée média du chunk (pas l'horloge murale).
   */
  releaseForVideoTick(
    durationMs: number,
    sinks: { mic?: Writable | null; desktop?: Writable | null }
  ): void {
    const tickMs = Math.max(0, durationMs)
    if (tickMs === 0) return

    if (this.awaitingFirstFrame) {
      this.awaitingFirstFrame = false
      this.sessionWallStart = Date.now()
      this.alignBufferToTarget()
    }

    this.videoTimelineMs += tickMs
    this.correctDrift()
    this.enforceBufferBounds('mic')
    this.enforceBufferBounds('desktop')

    const bytes = Math.round((PCM_BYTES_PER_SECOND * tickMs) / 1000)
    if (bytes === 0) return

    if (sinks.mic) {
      this.writeBytes(this.micChunks, bytes, sinks.mic, (n) => { this.micBytes -= n })
    }
    if (sinks.desktop) {
      this.writeBytes(this.desktopChunks, bytes, sinks.desktop, (n) => { this.desktopBytes -= n })
    }
  }

  prepareForVideo(): void {
    if (!this.awaitingFirstFrame) return
    this.alignBufferToTarget()
  }

  /** Conserve uniquement les TARGET_BUFFER_MS les plus récents au premier frame vidéo. */
  private alignBufferToTarget(): void {
    this.trimToTarget('mic')
    this.trimToTarget('desktop')
  }

  private correctDrift(): void {
    if (this.sessionWallStart <= 0) return
    const wallMs = Date.now() - this.sessionWallStart
    const lagMs = Math.max(0, wallMs - this.videoTimelineMs)
    this.correctChannelDrift('mic', this.micBytes, lagMs)
    this.correctChannelDrift('desktop', this.desktopBytes, lagMs)
  }

  private correctChannelDrift(kind: 'mic' | 'desktop', bytes: number, lagMs: number): void {
    const bufferMs = bytes / (PCM_BYTES_PER_SECOND / 1000)
    const excessMs = bufferMs - (lagMs + TARGET_BUFFER_MS)
    if (excessMs > 250) {
      this.trimToTarget(kind)
    }
  }

  private enforceBufferBounds(kind: 'mic' | 'desktop'): void {
    const maxBytes = Math.floor((PCM_BYTES_PER_SECOND * MAX_BUFFER_MS) / 1000)
    const bytes = kind === 'mic' ? this.micBytes : this.desktopBytes
    if (bytes <= maxBytes) return
    this.trimToTarget(kind)
  }

  private trimToTarget(kind: 'mic' | 'desktop'): void {
    const targetBytes = Math.floor((PCM_BYTES_PER_SECOND * TARGET_BUFFER_MS) / 1000)
    if (kind === 'mic') {
      while (this.micBytes > targetBytes && this.micChunks.length > 0) {
        const dropped = this.micChunks.shift()!
        this.micBytes -= dropped.length
      }
      return
    }
    while (this.desktopBytes > targetBytes && this.desktopChunks.length > 0) {
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
