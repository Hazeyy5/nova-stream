import { useEffect } from 'react'
import { gainDbToLinear } from '../lib/audioGain'
import { connectCenteredMono } from '../lib/monoAudio'
import { acquireMicStream, releaseMicStream } from '../lib/micStreamPool'

export function useMicMonitor(
  deviceName: string | undefined,
  micEnabled: boolean,
  gainDb: number,
  monitorEnabled: boolean,
  micMono = false
): void {
  useEffect(() => {
    if (!monitorEnabled || !micEnabled || !deviceName) return

    let active = true
    let audioCtx: AudioContext | null = null

    const teardown = () => {
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {})
      }
      audioCtx = null
      releaseMicStream(deviceName)
    }

    ;(async () => {
      try {
        const stream = await acquireMicStream(deviceName)
        if (!active || !stream) {
          if (stream) releaseMicStream(deviceName)
          return
        }

        audioCtx = new AudioContext()
        const source = audioCtx.createMediaStreamSource(stream)
        const gain = audioCtx.createGain()
        gain.gain.value = gainDbToLinear(gainDb)

        if (micMono) {
          connectCenteredMono(source, gain, audioCtx.destination, source.channelCount || 2)
        } else {
          source.connect(gain)
          gain.connect(audioCtx.destination)
        }
      } catch {
        teardown()
      }
    })()

    return () => {
      active = false
      teardown()
    }
  }, [deviceName, micEnabled, gainDb, monitorEnabled, micMono])
}
