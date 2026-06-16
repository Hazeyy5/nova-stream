import type { StreamSettings } from '../../src/types'

/** Compensation fixe au démarrage — le pacing A/V verrouille la timeline ensuite. */
const AUTO_AUDIO_DELAY_H264_MS = 0
const AUTO_AUDIO_DELAY_WEBM_MS = 0

/** Ajustement manuel optionnel (±500 ms) — utilisé seulement si audioSyncAuto est désactivé. */
export function resolveManualAudioTrimMs(settings: StreamSettings): number {
  if (typeof settings.audioSyncOffsetMs !== 'number' || !Number.isFinite(settings.audioSyncOffsetMs)) {
    return 0
  }
  return Math.max(-500, Math.min(500, settings.audioSyncOffsetMs))
}

/**
 * Décalage audio appliqué dans FFmpeg.
 * Positif = retarder l'audio (adelay) — corrige un son en avance sur l'image.
 * Négatif = couper le début de l'audio (atrim).
 */
export function resolveStreamAudioTrimMs(
  settings: StreamSettings,
  videoInputFormat: 'h264' | 'webm' = 'webm'
): number {
  if (settings.audioSyncAuto === false) {
    return resolveManualAudioTrimMs(settings)
  }
  return videoInputFormat === 'h264' ? AUTO_AUDIO_DELAY_H264_MS : AUTO_AUDIO_DELAY_WEBM_MS
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
