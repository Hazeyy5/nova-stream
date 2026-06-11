import { resolveInputDeviceId } from './audioDeviceResolver'

interface PoolEntry {
  stream: MediaStream
  refs: number
}

const pool = new Map<string, PoolEntry>()
const pending = new Map<string, Promise<MediaStream | null>>()

async function openMic(deviceName: string): Promise<MediaStream | null> {
  const deviceId = await resolveInputDeviceId(deviceName)
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: deviceId
        ? {
            deviceId: { ideal: deviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        : { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    })
  } catch {
    return null
  }
}

export async function acquireMicStream(deviceName: string): Promise<MediaStream | null> {
  if (!deviceName) return null

  const existing = pool.get(deviceName)
  if (existing) {
    existing.refs += 1
    return existing.stream
  }

  let load = pending.get(deviceName)
  if (!load) {
    load = openMic(deviceName).finally(() => pending.delete(deviceName))
    pending.set(deviceName, load)
  }

  const stream = await load
  if (!stream) return null

  const again = pool.get(deviceName)
  if (again) {
    again.refs += 1
    stream.getTracks().forEach((t) => t.stop())
    return again.stream
  }

  pool.set(deviceName, { stream, refs: 1 })
  return stream
}

export function releaseMicStream(deviceName: string): void {
  const entry = pool.get(deviceName)
  if (!entry) return
  entry.refs -= 1
  if (entry.refs <= 0) {
    entry.stream.getTracks().forEach((t) => t.stop())
    pool.delete(deviceName)
  }
}
