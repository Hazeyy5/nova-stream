import { useEffect, useRef, useState } from 'react'
import { gainDbToLinear } from '../lib/audioGain'
import { linearToDb, linearToDisplayLevel } from '../lib/audioLevel'
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

export function useAudioMeter(
  deviceName: string | undefined,
  monitorEnabled: boolean,
  gainDb = 0,
  micMono = false
): AudioMeterReading {
  const [reading, setReading] = useState<AudioMeterReading>(SILENT)
  const peakHoldRef = useRef(0)
  const peakDbHoldRef = useRef(-60)
  const readingRef = useRef<AudioMeterReading>(SILENT)

  useEffect(() => {
    if (!monitorEnabled || !deviceName || document.hidden) {
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
    let timeData: Float32Array | null = null
    let lastEmit = 0

    const teardown = () => {
      cancelAnimationFrame(raf)
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {})
      }
      audioCtx = null
      analyser = null
      timeData = null
      if (deviceName) releaseMicStream(deviceName)
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (!active || !analyser || !timeData || document.hidden) return
      if (now - lastEmit < 33) return

      analyser.getFloatTimeDomainData(timeData)

      let peak = 0
      let sumSq = 0
      for (let i = 0; i < timeData.length; i++) {
        const sample = Math.abs(timeData[i])
        if (sample > peak) peak = sample
        sumSq += sample * sample
      }
      const rms = Math.sqrt(sumSq / timeData.length)

      const displayPeak = linearToDisplayLevel(peak)
      const displayRms = linearToDisplayLevel(rms)

      if (displayPeak > peakHoldRef.current) {
        peakHoldRef.current = displayPeak
        peakDbHoldRef.current = linearToDb(peak)
      } else {
        peakHoldRef.current *= 0.88
        peakDbHoldRef.current = linearToDb(peakHoldRef.current)
      }

      lastEmit = now
      const next: AudioMeterReading = {
        peak: Math.min(1, peakHoldRef.current),
        rms: Math.min(1, displayRms),
        peakDb: linearToDb(peak),
        displayDb: peakDbHoldRef.current
      }

      const prev = readingRef.current
      if (
        Math.abs(next.peak - prev.peak) < 0.008 &&
        Math.abs(next.rms - prev.rms) < 0.008
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
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume()
        }

        analyser = audioCtx.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.35
        timeData = new Float32Array(analyser.fftSize)

        const source = audioCtx.createMediaStreamSource(stream)
        const gain = audioCtx.createGain()
        gain.gain.value = gainDbToLinear(gainDb)

        const silentOut = audioCtx.createGain()
        silentOut.gain.value = 0.0001

        if (micMono) {
          connectCenteredMono(source, gain, analyser, source.channelCount || 2)
          analyser.connect(silentOut)
        } else {
          source.connect(gain)
          gain.connect(analyser)
          analyser.connect(silentOut)
        }
        silentOut.connect(audioCtx.destination)

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
  }, [deviceName, monitorEnabled, gainDb, micMono])

  return reading
}

export function formatMeterDb(db: number, muted: boolean): string {
  if (muted) return 'MUTE'
  if (db <= -59.5) return '-inf'
  return `${db.toFixed(1)} dB`
}
