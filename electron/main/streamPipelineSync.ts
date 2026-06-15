import type { StreamSettings } from '../../src/types'

/** Ajustement manuel optionnel (±500 ms) — le pipeline gère la synchro par défaut. */
export function resolveManualAudioTrimMs(settings: StreamSettings): number {
  if (settings.audioSyncAuto !== false) return 0
  if (typeof settings.audioSyncOffsetMs !== 'number' || !Number.isFinite(settings.audioSyncOffsetMs)) {
    return 0
  }
  return Math.max(-500, Math.min(500, settings.audioSyncOffsetMs))
}

export function buildAudioTrimSuffix(trimMs: number, channels: number): string {
  if (trimMs > 5) {
    const perChannel = Array.from({ length: channels }, () => Math.round(trimMs)).join('|')
    return `,adelay=${perChannel}`
  }
  if (trimMs < -5) {
    const startSec = (-trimMs / 1000).toFixed(3)
    return `,atrim=start=${startSec},asetpts=PTS-STARTPTS`
  }
  return ''
}
