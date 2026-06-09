type NativeAudioModule = typeof import('native-audio-node')

let cached: NativeAudioModule | null = null
let loading: Promise<NativeAudioModule | null> | null = null

export async function loadNativeAudioModule(): Promise<NativeAudioModule | null> {
  if (process.platform !== 'win32') return null
  if (cached) return cached

  if (!loading) {
    loading = import('native-audio-node')
      .then((mod) => {
        cached = mod
        return mod
      })
      .catch((err) => {
        console.error('[native-audio-node] chargement impossible:', err)
        return null
      })
  }

  return loading
}

export function isNativeAudioAvailable(): boolean {
  return process.platform === 'win32'
}
