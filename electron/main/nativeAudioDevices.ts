import { loadNativeAudioModule, isNativeAudioAvailable } from './nativeAudioLoader'
import type { MediaDevice } from '../../src/types'

interface NativeAudioDevice {
  id: string
  name: string
  isInput: boolean
  isOutput: boolean
  isDefault: boolean
}

function mapNativeDevice(device: NativeAudioDevice): MediaDevice {
  return {
    name: device.name,
    type: 'audio',
    audioRole: device.isOutput ? 'output' : 'input',
    backend: 'native',
    deviceId: device.id,
    isDefault: device.isDefault
  }
}

export { isNativeAudioAvailable }

export async function listNativeMediaDevices(): Promise<MediaDevice[]> {
  if (!isNativeAudioAvailable()) return []

  const mod = await loadNativeAudioModule()
  if (!mod) return []

  try {
    return mod.listAudioDevices().map(mapNativeDevice)
  } catch {
    return []
  }
}

export function listNativeVideoDevicesFromDshow(dshowDevices: MediaDevice[]): MediaDevice[] {
  return dshowDevices.filter((d) => d.type === 'video')
}
