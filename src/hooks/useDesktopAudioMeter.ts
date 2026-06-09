import { useEffect, useState } from 'react'
import type { AudioMeterReading } from './useAudioMeter'
import { gainDbToLinear } from '../lib/audioGain'

const SILENT: AudioMeterReading = {
  peak: 0,
  rms: 0,
  peakDb: -60,
  displayDb: -60
}

export function useDesktopAudioMeter(enabled: boolean, gainDb = 0): AudioMeterReading {
  const [reading, setReading] = useState<AudioMeterReading>(SILENT)

  useEffect(() => {
    if (!enabled) {
      setReading(SILENT)
      return
    }

    let active = true
    const gain = gainDbToLinear(gainDb)

    const handler = (level: AudioMeterReading) => {
      if (!active) return
      setReading({
        peak: Math.min(1, level.peak * gain),
        rms: Math.min(1, level.rms * gain),
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
  }, [enabled, gainDb])

  return reading
}
