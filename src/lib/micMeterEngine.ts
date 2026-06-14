import { gainDbToLinear } from './audioGain'
import { linearToDb, linearToDisplayLevel } from './audioLevel'
import { connectCenteredMono } from './monoAudio'
import { acquireMicStream, releaseMicStream } from './micStreamPool'
import type { AudioMeterReading } from '../hooks/useAudioMeter'

const SILENT: AudioMeterReading = {
  peak: 0,
  rms: 0,
  peakDb: -60,
  displayDb: -60
}

let sharedCtx: AudioContext | null = null
let resumeHooked = false

function getContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AudioContext()
  }
  return sharedCtx
}

export async function ensureAudioContextRunning(): Promise<AudioContext> {
  const ctx = getContext()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
  return ctx
}

export function hookAudioContextResume(): void {
  if (resumeHooked) return
  resumeHooked = true
  const wake = () => { void ensureAudioContextRunning() }
  window.addEventListener('pointerdown', wake, { passive: true })
  window.addEventListener('keydown', wake, { passive: true })
}

type MeterListener = (reading: AudioMeterReading) => void

class MicMeterEngine {
  private deviceName: string | null = null
  private gainDb = 0
  private micMono = false
  private monitorEnabled = false
  private micStreamEnabled = false

  private source: MediaStreamAudioSourceNode | null = null
  private gain: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private monitorGain: GainNode | null = null
  private silentOut: GainNode | null = null
  private timeData: Float32Array | null = null

  private listeners = new Set<MeterListener>()
  private raf = 0
  private peakHold = 0
  private peakDbHold = -60
  private starting: Promise<void> | null = null

  subscribe(listener: MeterListener): () => void {
    this.listeners.add(listener)
    listener(this.lastReading())
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) {
        this.stopGraph()
      } else {
        this.syncMonitorOutput()
      }
    }
  }

  setGainDb(db: number): void {
    this.gainDb = db
    if (this.gain) this.gain.gain.value = gainDbToLinear(db)
    this.emit(this.lastReading())
  }

  setMicMono(mono: boolean): void {
    if (this.micMono === mono) return
    this.micMono = mono
    if (this.deviceName) void this.rebuildGraph(this.deviceName)
  }

  setMonitorEnabled(enabled: boolean, micStreamEnabled: boolean): void {
    this.monitorEnabled = enabled
    this.micStreamEnabled = micStreamEnabled
    this.syncMonitorOutput()
  }

  async setDevice(deviceName: string | null): Promise<void> {
    if (!deviceName) {
      this.stopGraph()
      this.emit(SILENT)
      return
    }
    if (deviceName === this.deviceName && this.analyser) return
    await this.rebuildGraph(deviceName)
  }

  private lastReading(): AudioMeterReading {
    return {
      peak: Math.min(1, this.peakHold),
      rms: 0,
      peakDb: this.peakDbHold,
      displayDb: this.peakDbHold
    }
  }

  private emit(reading: AudioMeterReading): void {
    const snapshot = { ...reading }
    for (const listener of this.listeners) listener(snapshot)
  }

  private syncMonitorOutput(): void {
    if (!this.monitorGain) return
    const audible = this.monitorEnabled && this.micStreamEnabled
    this.monitorGain.gain.value = audible ? 1 : 0
  }

  private stopGraph(): void {
    cancelAnimationFrame(this.raf)
    this.raf = 0

    if (this.deviceName) {
      releaseMicStream(this.deviceName)
      this.deviceName = null
    }

    this.source?.disconnect()
    this.gain?.disconnect()
    this.analyser?.disconnect()
    this.monitorGain?.disconnect()
    this.silentOut?.disconnect()

    this.source = null
    this.gain = null
    this.analyser = null
    this.monitorGain = null
    this.silentOut = null
    this.timeData = null
    this.peakHold = 0
    this.peakDbHold = -60
  }

  private async rebuildGraph(deviceName: string): Promise<void> {
    if (this.starting) await this.starting

    this.starting = (async () => {
      this.stopGraph()
      this.deviceName = deviceName

      const stream = await acquireMicStream(deviceName)
      if (!stream || this.deviceName !== deviceName) {
        if (stream && deviceName) releaseMicStream(deviceName)
        this.deviceName = null
        this.emit(SILENT)
        return
      }

      const ctx = await ensureAudioContextRunning()
      hookAudioContextResume()

      this.analyser = ctx.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.2
      this.timeData = new Float32Array(this.analyser.fftSize)

      this.gain = ctx.createGain()
      this.gain.gain.value = gainDbToLinear(this.gainDb)

      this.monitorGain = ctx.createGain()
      this.monitorGain.gain.value = 0

      this.silentOut = ctx.createGain()
      this.silentOut.gain.value = 0.0001

      this.source = ctx.createMediaStreamSource(stream)

      if (this.micMono) {
        connectCenteredMono(this.source, this.gain, this.analyser, this.source.channelCount || 2)
        this.analyser.connect(this.silentOut)
      } else {
        this.source.connect(this.gain)
        this.gain.connect(this.analyser)
        this.analyser.connect(this.silentOut)
      }
      this.gain.connect(this.monitorGain)
      this.monitorGain.connect(ctx.destination)
      this.silentOut.connect(ctx.destination)

      this.syncMonitorOutput()
      this.peakHold = 0
      this.peakDbHold = -60
      this.startMeterLoop()
    })()

    try {
      await this.starting
    } finally {
      this.starting = null
    }
  }

  private startMeterLoop(): void {
    cancelAnimationFrame(this.raf)
    let lastEmit = 0

    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick)
      if (!this.analyser || !this.timeData) return

      if (sharedCtx?.state === 'suspended') {
        void ensureAudioContextRunning()
      }

      if (now - lastEmit < 33) return
      lastEmit = now

      this.analyser.getFloatTimeDomainData(this.timeData)

      let peak = 0
      let sumSq = 0
      for (let i = 0; i < this.timeData.length; i++) {
        const sample = Math.abs(this.timeData[i])
        if (sample > peak) peak = sample
        sumSq += sample * sample
      }
      const rms = Math.sqrt(sumSq / this.timeData.length)

      const displayPeak = linearToDisplayLevel(peak)
      const displayRms = linearToDisplayLevel(rms)

      if (displayPeak > this.peakHold) {
        this.peakHold = displayPeak
        this.peakDbHold = linearToDb(peak)
      } else {
        this.peakHold *= 0.9
        this.peakDbHold = linearToDb(this.peakHold)
      }

      this.emit({
        peak: Math.min(1, this.peakHold),
        rms: Math.min(1, displayRms),
        peakDb: linearToDb(peak),
        displayDb: this.peakDbHold
      })
    }

    this.raf = requestAnimationFrame(tick)
  }
}

export const micMeterEngine = new MicMeterEngine()
