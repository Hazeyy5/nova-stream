import { useEffect, useRef } from 'react'
import { gainDbToLinear } from '../lib/audioGain'
import { connectCenteredMono } from '../lib/monoAudio'

async function resolveInputDeviceId(deviceName: string): Promise<string | undefined> {
  if (!deviceName) return undefined

  try {
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
    probe.getTracks().forEach((t) => t.stop())
  } catch {
    return undefined
  }

  const inputs = (await navigator.mediaDevices.enumerateDevices())
    .filter((d) => d.kind === 'audioinput')

  if (inputs.length === 0) return undefined

  try {
    const nativeDevices = await window.novaStream.devices.listMedia()
    const nativeMatch = nativeDevices.find(
      (d) => d.type === 'audio' && d.audioRole === 'input' && d.name === deviceName
    )
    if (nativeMatch?.deviceId) {
      const byId = inputs.find((d) => d.deviceId === nativeMatch.deviceId)
      if (byId) return byId.deviceId
    }
  } catch {
    /* ignore */
  }

  const exact = inputs.find((d) => d.label === deviceName)
  if (exact) return exact.deviceId

  const key = deviceName.toLowerCase()
  const partial = inputs.find((d) => d.label.toLowerCase() === key)
  if (partial) return partial.deviceId

  const contains = inputs.find((d) => {
    const label = d.label.toLowerCase()
    return label.includes(key) || key.includes(label)
  })
  return contains?.deviceId
}

export function useMicMonitor(
  deviceName: string | undefined,
  micEnabled: boolean,
  gainDb: number,
  monitorEnabled: boolean,
  micMono = false
): void {
  const activeRef = useRef(false)

  useEffect(() => {
    if (!monitorEnabled || !micEnabled || !deviceName) {
      activeRef.current = false
      return
    }

    let active = true
    activeRef.current = true
    let stream: MediaStream | null = null
    let audioCtx: AudioContext | null = null

    const teardown = () => {
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {})
      }
      audioCtx = null
    }

    ;(async () => {
      try {
        const deviceId = await resolveInputDeviceId(deviceName)
        if (!active) return

        stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId
            ? {
                deviceId: { exact: deviceId },
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
              }
            : {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
              }
        })

        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
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
      activeRef.current = false
      teardown()
    }
  }, [deviceName, micEnabled, gainDb, monitorEnabled, micMono])
}
