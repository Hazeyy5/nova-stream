import { useEffect, useRef, useState } from 'react'

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

async function resolveDeviceId(deviceName: string): Promise<string | undefined> {
  try {
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
    probe.getTracks().forEach((t) => t.stop())
  } catch {
    return undefined
  }

  const inputs = (await navigator.mediaDevices.enumerateDevices())
    .filter((d) => d.kind === 'audioinput')

  if (inputs.length === 0) return undefined
  if (!deviceName) return inputs[0].deviceId

  const key = deviceName.toLowerCase()
  const exact = inputs.find((d) => d.label === deviceName)
  if (exact) return exact.deviceId

  const partial = inputs.find((d) => {
    const label = d.label.toLowerCase()
    return label.includes(key) || key.includes(label)
  })
  return partial?.deviceId ?? inputs[0].deviceId
}

export function useAudioMeter(
  deviceName: string | undefined,
  enabled: boolean,
  volume: number
): AudioMeterReading {
  const [reading, setReading] = useState<AudioMeterReading>(SILENT)
  const peakHoldRef = useRef(0)
  const peakDbHoldRef = useRef(-60)

  useEffect(() => {
    if (!enabled || !deviceName || document.hidden) {
      peakHoldRef.current = 0
      peakDbHoldRef.current = -60
      setReading(SILENT)
      return
    }

    let active = true
    let raf = 0
    let audioCtx: AudioContext | null = null
    let stream: MediaStream | null = null
    let analyser: AnalyserNode | null = null
    const timeData = new Uint8Array(2048)
    let lastEmit = 0

    const teardown = () => {
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {})
      }
      audioCtx = null
      analyser = null
    }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (!active || !analyser || document.hidden) return
      if (now - lastEmit < 32) return

      analyser.getByteTimeDomainData(timeData)

      let peak = 0
      let sumSq = 0
      for (let i = 0; i < timeData.length; i++) {
        const sample = Math.abs(timeData[i] - 128) / 128
        if (sample > peak) peak = sample
        sumSq += sample * sample
      }
      const rms = Math.sqrt(sumSq / timeData.length)

      const gain = volume / 100
      const peakDb = linearToDb(peak * gain)
      const rmsDb = linearToDb(rms * gain)

      if (peak > peakHoldRef.current) {
        peakHoldRef.current = peak
        peakDbHoldRef.current = peakDb
      } else {
        peakHoldRef.current *= 0.92
        peakDbHoldRef.current = linearToDb(peakHoldRef.current * gain)
      }

      lastEmit = now
      setReading({
        peak: peakHoldRef.current,
        rms,
        peakDb,
        displayDb: peakDbHoldRef.current
      })
    }

    ;(async () => {
      try {
        const deviceId = await resolveDeviceId(deviceName)
        if (!active) return

        stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId
            ? {
                deviceId: { ideal: deviceId },
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
              }
            : { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        })

        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        audioCtx = new AudioContext()
        analyser = audioCtx.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.3

        const source = audioCtx.createMediaStreamSource(stream)
        source.connect(analyser)

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
      setReading(SILENT)
    }
  }, [deviceName, enabled, volume])

  return reading
}

export function formatMeterDb(db: number, muted: boolean): string {
  if (muted) return 'MUTE'
  if (db <= -59.5) return '-inf'
  return `${db.toFixed(1)} dB`
}
