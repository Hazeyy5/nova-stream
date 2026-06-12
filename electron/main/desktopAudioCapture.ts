import { loadNativeAudioModule } from './nativeAudioLoader'
import { pcmToS16le, type PcmInputFormat } from './pcmConvert'

const DESKTOP_SAMPLE_RATE = 44100

interface NativeRecorder {
  on(event: 'data', cb: (chunk: { data: Buffer }) => void): void
  on(event: 'metadata', cb: (meta: PcmInputFormat & { sampleRate?: number }) => void): void
  on(event: 'error', cb: () => void): void
  start(): Promise<void>
  stop(): Promise<void>
  isActive(): boolean
}

export class DesktopAudioCapture {
  private recorder: NativeRecorder | null = null
  private format: PcmInputFormat | null = null
  private pending: Buffer[] = []

  async start(onData: (chunk: Buffer) => void): Promise<void> {
    if (this.recorder) return

    const mod = await loadNativeAudioModule()
    if (!mod) return

    this.format = null
    this.pending = []

    const recorder = new mod.SystemAudioRecorder({
      sampleRate: DESKTOP_SAMPLE_RATE,
      chunkDurationMs: 20,
      stereo: true,
      emitSilence: true
    }) as NativeRecorder

    const flush = (chunk: Buffer) => {
      onData(pcmToS16le(chunk, this.format))
    }

    recorder.on('metadata', (meta) => {
      this.format = {
        isFloat: meta.isFloat,
        bitsPerChannel: meta.bitsPerChannel,
        channelsPerFrame: meta.channelsPerFrame
      }
      for (const buf of this.pending) flush(buf)
      this.pending = []
    })

    recorder.on('data', (chunk) => {
      if (!this.format) {
        this.pending.push(chunk.data)
        return
      }
      flush(chunk.data)
    })
    recorder.on('error', () => { /* ignoré — ffmpeg gère l'absence de flux */ })

    await recorder.start()
    this.recorder = recorder
  }

  async stop(): Promise<void> {
    if (!this.recorder) return
    const recorder = this.recorder
    this.recorder = null
    this.format = null
    this.pending = []
    try {
      await recorder.stop()
    } catch {
      /* ignore */
    }
  }

  isActive(): boolean {
    return this.recorder?.isActive() ?? false
  }
}

export const DESKTOP_AUDIO_PCM = {
  sampleRate: DESKTOP_SAMPLE_RATE,
  channels: 2,
  format: 's16le' as const
}
