import type { StreamSettings } from '../../src/types'

/**
 * Décalage vidéo (itsoffset) — uniquement si le micro est lu en direct par FFmpeg (dshow).
 * Avec le pipe PCM synchronisé sur les chunks vidéo, l'offset auto est nul.
 */
const LEGACY_VIDEO_OFFSET_H264_SEC = 0.14
const LEGACY_VIDEO_OFFSET_WEBM_SEC = 0.24

export interface StreamSyncOptions {
  /** Micro injecté via pipe Node, aligné sur les ticks vidéo (mode live actuel). */
  micViaPipe?: boolean
}

/** Ajustement manuel optionnel (±500 ms). */
export function resolveManualAudioTrimMs(settings: StreamSettings): number {
  if (typeof settings.audioSyncOffsetMs !== 'number' || !Number.isFinite(settings.audioSyncOffsetMs)) {
    return 0
  }
  return Math.max(-500, Math.min(500, settings.audioSyncOffsetMs))
}

export function resolveVideoItsoffsetSec(
  settings: StreamSettings,
  videoInputFormat: 'h264' | 'webm' = 'webm',
  options: StreamSyncOptions = {}
): number {
  const pipedMic = options.micViaPipe === true

  if (settings.audioSyncAuto === false) {
    const manualMs = resolveManualAudioTrimMs(settings)
    if (manualMs < 0) {
      // Son en retard → retarder la vidéo
      const legacyBase = videoInputFormat === 'h264' ? LEGACY_VIDEO_OFFSET_H264_SEC : LEGACY_VIDEO_OFFSET_WEBM_SEC
      const base = pipedMic ? 0 : legacyBase
      return base + -manualMs / 1000
    }
    if (manualMs > 0) {
      // Son en avance → adelay audio (resolveStreamAudioTrimMs), pas d'itsoffset vidéo
      return 0
    }
  }

  if (pipedMic) return 0

  return videoInputFormat === 'h264' ? LEGACY_VIDEO_OFFSET_H264_SEC : LEGACY_VIDEO_OFFSET_WEBM_SEC
}

/**
 * Décalage audio FFmpeg (adelay) — seulement si son en avance en mode manuel.
 * Le mode auto avec pipe micro : audio déjà calé sur les chunks vidéo.
 */
export function resolveStreamAudioTrimMs(
  settings: StreamSettings,
  _videoInputFormat: 'h264' | 'webm' = 'webm',
  _options: StreamSyncOptions = {}
): number {
  if (settings.audioSyncAuto === false) {
    const manualMs = resolveManualAudioTrimMs(settings)
    if (manualMs > 5) return manualMs
  }
  return 0
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
