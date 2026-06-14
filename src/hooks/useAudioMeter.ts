import { useEffect, useState } from 'react'
import { micMeterEngine } from '../lib/micMeterEngine'

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

  useEffect(() => {
    if (!monitorEnabled || !deviceName) {
      setReading(SILENT)
      return
    }

    let active = true
    const unsub = micMeterEngine.subscribe((next) => {
      if (active) setReading(next)
    })

    void micMeterEngine.setDevice(deviceName)

    return () => {
      active = false
      unsub()
      void micMeterEngine.setDevice(null)
      setReading(SILENT)
    }
  }, [deviceName, monitorEnabled])

  useEffect(() => {
    micMeterEngine.setGainDb(gainDb)
  }, [gainDb])

  useEffect(() => {
    micMeterEngine.setMicMono(micMono)
  }, [micMono])

  return reading
}

export function formatMeterDb(db: number, muted: boolean): string {
  if (muted) return 'MUTE'
  if (db <= -59.5) return '-inf'
  return `${db.toFixed(1)} dB`
}
