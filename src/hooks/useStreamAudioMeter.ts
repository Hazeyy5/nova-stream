import { useEffect, useState } from 'react'
import type { AudioMeterReading } from './useAudioMeter'
import { gainDbToLinear } from '../lib/audioGain'
import { linearToDisplayLevel } from '../lib/audioLevel'

const SILENT: AudioMeterReading = {
  peak: 0,
  rms: 0,
  peakDb: -60,
  displayDb: -60
}

type StreamMeterPayload = {
  mic: AudioMeterReading
  desktop: AudioMeterReading
}

export function useStreamAudioMeter(
  active: boolean,
  channel: 'mic' | 'desktop',
  gainDb = 0
): AudioMeterReading {
  const [reading, setReading] = useState<AudioMeterReading>(SILENT)

  useEffect(() => {
    if (!active) {
      setReading(SILENT)
      return
    }

    let live = true
    const gain = gainDbToLinear(gainDb)

    const handler = (levels: StreamMeterPayload) => {
      if (!live) return
      const raw = levels[channel]
      const peak = Math.min(1, linearToDisplayLevel(raw.peak) * gain)
      const rms = Math.min(1, linearToDisplayLevel(raw.rms) * gain)
      setReading({
        peak,
        rms,
        peakDb: raw.peakDb,
        displayDb: raw.displayDb
      })
    }

    const unsub = window.novaStream.audioMeter.onStreamLevel(handler)
    void window.novaStream.audioMeter.subscribeStream()

    return () => {
      live = false
      unsub()
      void window.novaStream.audioMeter.unsubscribeStream()
      setReading(SILENT)
    }
  }, [active, channel, gainDb])

  return reading
}
