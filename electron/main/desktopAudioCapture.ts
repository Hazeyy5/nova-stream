import { loadNativeAudioModule } from './nativeAudioLoader'

const DESKTOP_SAMPLE_RATE = 44100

interface NativeRecorder {
  on(event: 'data', cb: (chunk: { data: Buffer }) => void): void
  on(event: 'error', cb: () => void): void
  start(): Promise<void>
  stop(): Promise<void>
  isActive(): boolean
}

export class DesktopAudioCapture {
  private recorder: NativeRecorder | null = null

  async start(onData: (chunk: Buffer) => void): Promise<void> {
    if (this.recorder) return

    const mod = await loadNativeAudioModule()
    if (!mod) return

    const recorder = new mod.SystemAudioRecorder({
      sampleRate: DESKTOP_SAMPLE_RATE,
      chunkDurationMs: 20,
      stereo: true,
      emitSilence: true
    }) as NativeRecorder

    recorder.on('data', (chunk) => onData(chunk.data))
    recorder.on('error', () => { /* ignoré — ffmpeg gère l'absence de flux */ })

    await recorder.start()
    this.recorder = recorder
  }

  async stop(): Promise<void> {
    if (!this.recorder) return
    const recorder = this.recorder
    this.recorder = null
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
