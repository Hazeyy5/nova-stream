import type { WebContents } from 'electron'
import { loadNativeAudioModule } from './nativeAudioLoader'
import { applyNoiseFloor, levelFromPcmBuffer, PCM_NOISE_FLOOR, type PcmFormat } from './pcmLevel'

function linearToDisplayLevel(linear: number): number {
  if (linear <= 0.000001) return 0
  const db = 20 * Math.log10(linear)
  const normalized = (db + 42) / 42
  return Math.pow(Math.max(0, Math.min(1, normalized)), 0.65)
}

export interface AudioMeterLevel {
  peak: number
  rms: number
  peakDb: number
  displayDb: number
}

const SILENT: AudioMeterLevel = {
  peak: 0,
  rms: 0,
  peakDb: -60,
  displayDb: -60
}

interface NativeRecorder {
  on(event: 'data', cb: (chunk: { data: Buffer }) => void): void
  on(event: 'metadata', cb: (meta: PcmFormat & { sampleRate?: number; encoding?: string }) => void): void
  on(event: 'error', cb: () => void): void
  start(): Promise<void>
  stop(): Promise<void>
}

function linearToDb(linear: number): number {
  if (linear < 0.00001) return -60
  return Math.max(-60, Math.min(0, 20 * Math.log10(linear)))
}

class DesktopAudioMeterService {
  private subscribers = new Map<number, WebContents>()
  private recorder: NativeRecorder | null = null
  private starting: Promise<void> | null = null
  private pcmFormat: PcmFormat | null = null
  private peakHold = 0
  private peakDbHold = -60
  private lastLevel: AudioMeterLevel = SILENT
  private lastBroadcastAt = 0
  private pendingLevel: AudioMeterLevel | null = null
  private broadcastTimer: ReturnType<typeof setTimeout> | null = null

  subscribe(sender: WebContents): void {
    this.subscribers.set(sender.id, sender)
    sender.once('destroyed', () => this.unsubscribe(sender))
    void this.ensureStarted()
    sender.send('audioMeter:desktop', SILENT)
  }

  unsubscribe(sender: WebContents): void {
    this.subscribers.delete(sender.id)
    if (this.subscribers.size === 0) {
      void this.stop()
    }
  }

  private broadcast(level: AudioMeterLevel): void {
    this.lastLevel = level
    for (const [id, sender] of this.subscribers) {
      if (sender.isDestroyed()) {
        this.subscribers.delete(id)
        continue
      }
      sender.send('audioMeter:desktop', level)
    }
  }

  private onPcm(buffer: Buffer): void {
    const raw = levelFromPcmBuffer(buffer, this.pcmFormat)
    const peak = applyNoiseFloor(raw.peak)
    const rms = applyNoiseFloor(raw.rms)

    const peakDb = linearToDb(peak)
    const rmsDb = linearToDb(rms)

    if (peak > this.peakHold) {
      this.peakHold = peak
      this.peakDbHold = peakDb
    } else {
      this.peakHold *= 0.85
      this.peakDbHold = linearToDb(this.peakHold)
    }

    if (this.peakHold < PCM_NOISE_FLOOR) {
      this.peakHold = 0
      this.peakDbHold = -60
    }

    this.pendingLevel = {
      peak: linearToDisplayLevel(this.peakHold),
      rms: linearToDisplayLevel(rms),
      peakDb,
      displayDb: peak > 0 ? this.peakDbHold : rmsDb
    }

    const now = Date.now()
    if (now - this.lastBroadcastAt >= 50) {
      this.lastBroadcastAt = now
      this.broadcast(this.pendingLevel)
      return
    }

    if (!this.broadcastTimer) {
      this.broadcastTimer = setTimeout(() => {
        this.broadcastTimer = null
        this.lastBroadcastAt = Date.now()
        if (this.pendingLevel) this.broadcast(this.pendingLevel)
      }, 50)
    }
  }

  private async ensureStarted(): Promise<void> {
    if (this.recorder || this.starting) {
      await this.starting
      return
    }

    this.starting = (async () => {
      const mod = await loadNativeAudioModule()
      if (!mod || this.subscribers.size === 0) return

      const recorder = new mod.SystemAudioRecorder({
        sampleRate: 44100,
        chunkDurationMs: 20,
        stereo: true,
        emitSilence: true
      }) as NativeRecorder

      recorder.on('metadata', (meta) => {
        this.pcmFormat = {
          isFloat: meta.isFloat,
          bitsPerChannel: meta.bitsPerChannel,
          channelsPerFrame: meta.channelsPerFrame
        }
      })
      recorder.on('data', (chunk) => this.onPcm(chunk.data))
      recorder.on('error', () => this.broadcast(SILENT))

      try {
        await recorder.start()
        this.recorder = recorder
        this.pcmFormat = null
        this.peakHold = 0
        this.peakDbHold = -60
        this.lastLevel = SILENT
      } catch {
        this.broadcast(SILENT)
      }
    })()

    try {
      await this.starting
    } finally {
      this.starting = null
    }
  }

  private async stop(): Promise<void> {
    const recorder = this.recorder
    this.recorder = null
    this.pcmFormat = null
    this.peakHold = 0
    this.peakDbHold = -60
    this.lastLevel = SILENT

    if (!recorder) return
    try {
      await recorder.stop()
    } catch {
      /* ignore */
    }
  }
}

export const desktopAudioMeterService = new DesktopAudioMeterService()
