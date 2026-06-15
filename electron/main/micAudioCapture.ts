import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { resolveFfmpegPath } from './ffmpegPath'

const MIC_SAMPLE_RATE = 44100
const MIC_CHANNELS = 2

export const MIC_AUDIO_PCM = {
  sampleRate: MIC_SAMPLE_RATE,
  channels: MIC_CHANNELS,
  format: 's16le' as const
}

export class MicAudioCapture {
  private proc: ChildProcessWithoutNullStreams | null = null
  private linearGain = 1
  private muted = false

  setMix(linearGain: number, muted: boolean): void {
    this.linearGain = Math.max(0, linearGain)
    this.muted = muted
  }

  async start(device: string, onData: (chunk: Buffer) => void): Promise<void> {
    const ffmpegPath = resolveFfmpegPath()
    if (this.proc || !ffmpegPath || !device) return

    const proc = spawn(
      ffmpegPath,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-fflags',
        'nobuffer',
        '-flags',
        'low_delay',
        '-f',
        'dshow',
        '-i',
        `audio=${device}`,
        '-ac',
        String(MIC_CHANNELS),
        '-ar',
        String(MIC_SAMPLE_RATE),
        '-f',
        MIC_AUDIO_PCM.format,
        'pipe:1'
      ],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    )

    this.proc = proc
    proc.stdout.on('data', (chunk: Buffer) => {
      onData(this.processChunk(chunk))
    })
    proc.stderr.on('data', () => { /* erreurs ignorées — flux optionnel */ })
    proc.on('close', () => {
      if (this.proc === proc) this.proc = null
    })
  }

  private processChunk(chunk: Buffer): Buffer {
    if (this.muted || this.linearGain <= 0) {
      return Buffer.alloc(chunk.length)
    }
    if (Math.abs(this.linearGain - 1) < 0.001) {
      return chunk
    }

    const samples = Math.floor(chunk.length / 2)
    const out = Buffer.alloc(chunk.length)
    for (let i = 0; i < samples; i++) {
      const scaled = Math.round(chunk.readInt16LE(i * 2) * this.linearGain)
      out.writeInt16LE(Math.max(-32768, Math.min(32767, scaled)), i * 2)
    }
    return out
  }

  async stop(): Promise<void> {
    const proc = this.proc
    this.proc = null
    if (!proc) return
    try {
      proc.kill('SIGKILL')
    } catch {
      /* ignore */
    }
  }
}
