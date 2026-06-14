import { useEffect, useState } from 'react'
import type { AudioMeterReading } from './useAudioMeter'
import { gainDbToLinear } from '../lib/audioGain'

const SILENT: AudioMeterReading = {
  peak: 0,
  rms: 0,
  peakDb: -60,
  displayDb: -60
}

export function useDesktopAudioMeter(hasDevice: boolean, gainDb = 0): AudioMeterReading {
  const [reading, setReading] = useState<AudioMeterReading>(SILENT)

  useEffect(() => {
    if (!hasDevice) {
      setReading(SILENT)
      return
    }

    let active = true
    const gain = gainDbToLinear(gainDb)

    const handler = (level: AudioMeterReading) => {
      if (!active) return
      const peak = Math.min(1, level.peak * gain)
      const rms = Math.min(1, level.rms * gain)
      setReading({
        peak,
        rms,
        peakDb: level.peakDb,
        displayDb: level.displayDb
      })
    }

    const unsubDesktop = window.novaStream.audioMeter.onDesktopLevel(handler)
    void window.novaStream.audioMeter.subscribeDesktop()

    return () => {
      active = false
      unsubDesktop()
      void window.novaStream.audioMeter.unsubscribeDesktop()
      setReading(SILENT)
    }
  }, [hasDevice, gainDb])

  return reading
}
