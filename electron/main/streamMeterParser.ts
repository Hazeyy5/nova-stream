import type { WebContents } from 'electron'

export interface StreamMeterLevel {
  peak: number
  rms: number
  peakDb: number
  displayDb: number
}

const SILENT: StreamMeterLevel = {
  peak: 0,
  rms: 0,
  peakDb: -60,
  displayDb: -60
}

function dbfsToLinear(dbfs: number): number {
  if (!Number.isFinite(dbfs) || dbfs <= -60) return 0
  return Math.min(1, Math.pow(10, dbfs / 20))
}

function linearToDb(linear: number): number {
  if (linear < 0.00001) return -60
  return Math.max(-60, Math.min(0, 20 * Math.log10(linear)))
}

export class StreamMeterParser {
  private readonly order: Array<'mic' | 'desktop'>
  private cursor = 0
  private peakHold = { mic: 0, desktop: 0 }
  private peakDbHold = { mic: -60, desktop: -60 }

  constructor(channels: { mic: boolean; desktop: boolean }) {
    this.order = []
    if (channels.mic) this.order.push('mic')
    if (channels.desktop) this.order.push('desktop')
  }

  parseChunk(text: string): Partial<Record<'mic' | 'desktop', StreamMeterLevel>> | null {
    if (this.order.length === 0) return null

    let changed = false
    const updates: Partial<Record<'mic' | 'desktop', StreamMeterLevel>> = {}

    for (const line of text.split('\n')) {
      if (!line.includes('lavfi.astats.Overall.Peak_level')) continue
      const match = line.match(/lavfi\.astats\.Overall\.Peak_level=(-?\d+(?:\.\d+)?)/)
      if (!match) continue

      const channel = this.order[this.cursor % this.order.length]
      this.cursor += 1

      const linear = dbfsToLinear(parseFloat(match[1]))
      const peakDb = linearToDb(linear)

      if (linear > this.peakHold[channel]) {
        this.peakHold[channel] = linear
        this.peakDbHold[channel] = peakDb
      } else {
        this.peakHold[channel] *= 0.88
        this.peakDbHold[channel] = linearToDb(this.peakHold[channel])
      }

      if (this.peakHold[channel] < 0.0005) {
        this.peakHold[channel] = 0
        this.peakDbHold[channel] = -60
      }

      updates[channel] = {
        peak: this.peakHold[channel],
        rms: linear,
        peakDb,
        displayDb: this.peakDbHold[channel]
      }
      changed = true
    }

    return changed ? updates : null
  }
}

class StreamAudioMeterService {
  private subscribers = new Map<number, WebContents>()
  private levels = {
    mic: { ...SILENT },
    desktop: { ...SILENT }
  }

  subscribe(sender: WebContents): void {
    this.subscribers.set(sender.id, sender)
    sender.once('destroyed', () => this.unsubscribe(sender))
    sender.send('audioMeter:stream', { ...this.levels })
  }

  unsubscribe(sender: WebContents): void {
    this.subscribers.delete(sender.id)
  }

  push(updates: Partial<Record<'mic' | 'desktop', StreamMeterLevel>>): void {
    for (const [channel, level] of Object.entries(updates) as Array<['mic' | 'desktop', StreamMeterLevel]>) {
      this.levels[channel] = level
    }
    this.broadcast()
  }

  reset(): void {
    this.levels.mic = { ...SILENT }
    this.levels.desktop = { ...SILENT }
    this.broadcast()
  }

  private broadcast(): void {
    const payload = {
      mic: { ...this.levels.mic },
      desktop: { ...this.levels.desktop }
    }
    for (const [id, sender] of this.subscribers) {
      if (sender.isDestroyed()) {
        this.subscribers.delete(id)
        continue
      }
      sender.send('audioMeter:stream', payload)
    }
  }
}

export const streamAudioMeterService = new StreamAudioMeterService()
