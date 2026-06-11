import { useEffect, useRef, useState } from 'react'
import { gainDbToLinear } from '../lib/audioGain'
import { connectCenteredMono } from '../lib/monoAudio'
import { acquireMicStream, releaseMicStream } from '../lib/micStreamPool'

export interface AudioMeterReading {
  peak: number
  rms: number
  peakDb: number
  displayDb: number
}

const SILENT: AudioMeterReading = {
  peak: 0,
  rms: 0,
  peakDb: -60,
  displayDb: -60
}

function linearToDb(linear: number): number {
  if (linear < 0.00001) return -60
  return Math.max(-60, Math.min(0, 20 * Math.log10(linear)))
}

export function useAudioMeter(
  deviceName: string | undefined,
  enabled: boolean,
  gainDb = 0,
  micMono = false
): AudioMeterReading {
  const [reading, setReading] = useState<AudioMeterReading>(SILENT)
  const peakHoldRef = useRef(0)
  const peakDbHoldRef = useRef(-60)
  const readingRef = useRef<AudioMeterReading>(SILENT)

  useEffect(() => {
    if (!enabled || !deviceName || document.hidden) {
      peakHoldRef.current = 0
      peakDbHoldRef.current = -60
      readingRef.current = SILENT
      setReading(SILENT)
      return
    }

    let active = true
    let raf = 0
    let audioCtx: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    const timeData = new Uint8Array(1024)
    let lastEmit = 0

    const teardown = () => {
      cancelAnimationFrame(raf)
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {})
      }
      audioCtx = null
      analyser = null
      if (deviceName) releaseMicStream(deviceName)
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (!active || !analyser || document.hidden) return
      if (now - lastEmit < 50) return

      analyser.getByteTimeDomainData(timeData)

      let peak = 0
      let sumSq = 0
      for (let i = 0; i < timeData.length; i++) {
        const sample = Math.abs(timeData[i] - 128) / 128
        if (sample > peak) peak = sample
        sumSq += sample * sample
      }
      const rms = Math.sqrt(sumSq / timeData.length)

      if (peak > peakHoldRef.current) {
        peakHoldRef.current = peak
        peakDbHoldRef.current = linearToDb(peak)
      } else {
        peakHoldRef.current *= 0.92
        peakDbHoldRef.current = linearToDb(peakHoldRef.current)
      }

      lastEmit = now
      const next: AudioMeterReading = {
        peak: Math.min(1, peakHoldRef.current),
        rms: Math.min(1, rms),
        peakDb: linearToDb(peak),
        displayDb: peakDbHoldRef.current
      }

      const prev = readingRef.current
      if (
        Math.abs(next.peak - prev.peak) < 0.015 &&
        Math.abs(next.displayDb - prev.displayDb) < 0.5
      ) {
        return
      }

      readingRef.current = next
      setReading(next)
    }

    ;(async () => {
      try {
        const stream = await acquireMicStream(deviceName)
        if (!active || !stream) {
          if (stream && deviceName) releaseMicStream(deviceName)
          if (active) setReading(SILENT)
          return
        }

        audioCtx = new AudioContext()
        analyser = audioCtx.createAnalyser()
        analyser.fftSize = 1024
        analyser.smoothingTimeConstant = 0.5

        const source = audioCtx.createMediaStreamSource(stream)
        const gain = audioCtx.createGain()
        gain.gain.value = gainDbToLinear(gainDb)

        if (micMono) {
          connectCenteredMono(source, gain, analyser, source.channelCount || 2)
        } else {
          source.connect(gain)
          gain.connect(analyser)
        }

        peakHoldRef.current = 0
        peakDbHoldRef.current = -60
        raf = requestAnimationFrame(tick)
      } catch {
        if (active) setReading(SILENT)
      }
    })()

    const onVisibility = () => {
      if (document.hidden) {
        peakHoldRef.current = 0
        peakDbHoldRef.current = -60
        readingRef.current = SILENT
        setReading(SILENT)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisibility)
      teardown()
      peakHoldRef.current = 0
      peakDbHoldRef.current = -60
      readingRef.current = SILENT
      setReading(SILENT)
    }
  }, [deviceName, enabled, gainDb, micMono])

  return reading
}

export function formatMeterDb(db: number, muted: boolean): string {
  if (muted) return 'MUTE'
  if (db <= -59.5) return '-inf'
  return `${db.toFixed(1)} dB`
}
